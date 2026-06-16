// ════════════════════════════════════════════════════════════
// Gemini Orchestration Agent
// Tool-calling agent that drives the interview flow
// ════════════════════════════════════════════════════════════

import { ContextManager } from './contextManager';
import type { AgentAction, LiveSignals, QuestionCategory } from '@/types';

export interface InterviewConfig {
  mode: 'real' | 'practice';
  techSplit: number;
  hrSplit: number;
  codeSplit: number;
}

export class GeminiAgent {
  private contextManager: ContextManager;
  private config: InterviewConfig;
  private currentExpectedPoints: string[] = [];
  private questionCounter: number = 0;
  private consecutiveFollowUps: number = 0;
  private readonly MAX_CONSECUTIVE_FOLLOWUPS = 2;

  constructor(contextManager: ContextManager, config: InterviewConfig) {
    this.contextManager = contextManager;
    this.config = config;
  }

  /**
   * Compute which question types are still allowed based on remaining targets.
   * Returns the list of allowed types and the forced type (if only one remains).
   */
  private getAllowedTypes(): { allowed: QuestionCategory[]; forced: QuestionCategory | null } {
    const counts = this.contextManager.getQuestionTypeCounts();
    const targets = this.getTargets();
    const allowed: QuestionCategory[] = [];

    if (counts.technical < targets.tech) allowed.push('technical');
    if (counts.behavioral < targets.hr) allowed.push('behavioral');
    if (counts.coding < targets.code) allowed.push('coding');

    // If nothing is left (all targets met), allow end_session
    if (allowed.length === 0) return { allowed: [], forced: null };
    if (allowed.length === 1) return { allowed, forced: allowed[0] };
    return { allowed, forced: null };
  }

  /** Get the numerical targets for each question category */
  private getTargets(): { tech: number; hr: number; code: number; total: number } {
    if (this.config.mode === 'real') {
      const isTechRole = !['Product Manager', 'Other'].includes(this.contextManager.getJobProfile());
      if (isTechRole) {
        return { tech: 6, hr: 3, code: 3, total: 12 };
      } else {
        return { tech: 8, hr: 4, code: 0, total: 12 };
      }
    }
    // Practice mode — derive from splits
    const total = 12;
    const tech = Math.round(total * this.config.techSplit / 100);
    const hr = Math.round(total * this.config.hrSplit / 100);
    const code = Math.max(0, total - tech - hr); // remainder to avoid rounding drift
    return { tech, hr, code, total };
  }

  /**
   * Normalize a questionType returned by Gemini into the 3 canonical categories.
   * resume_specific / situational / unknown → mapped to "technical" or "behavioral".
   */
  private normalizeQuestionType(raw: string | undefined): QuestionCategory {
    if (!raw) return 'behavioral';
    const lower = raw.toLowerCase().trim();
    if (lower === 'coding') return 'coding';
    if (lower === 'technical') return 'technical';
    if (lower === 'behavioral') return 'behavioral';
    // Map situational → behavioral, resume_specific → technical
    if (lower === 'situational') return 'behavioral';
    if (lower === 'resume_specific') return 'technical';
    return 'behavioral';
  }

  /**
   * Post-validate and override the question type to respect the user's split targets.
   * If the AI returned a type whose bucket is already full, reassign to a bucket that still has room.
   */
  private enforceQuestionType(rawType: string | undefined): QuestionCategory {
    const normalized = this.normalizeQuestionType(rawType);
    const { allowed } = this.getAllowedTypes();

    // If the normalized type is still allowed, keep it
    if (allowed.includes(normalized)) return normalized;

    // Otherwise pick the allowed type with the most remaining room
    if (allowed.length > 0) {
      const counts = this.contextManager.getQuestionTypeCounts();
      const targets = this.getTargets();
      const remaining = allowed.map(t => {
        const key = t === 'technical' ? 'tech' : t === 'behavioral' ? 'hr' : 'code';
        const countKey = t;
        return { type: t, room: targets[key] - (counts[countKey] || 0) };
      });
      remaining.sort((a, b) => b.room - a.room);
      return remaining[0].type;
    }
    return normalized;
  }

  private getSystemPrompt(): string {
    const isTechRole = !['Product Manager', 'Other'].includes(this.contextManager.getJobProfile());
    const typeCounts = this.contextManager.getQuestionTypeCounts();
    const totalAsked = this.contextManager.getUnskippedMainQuestionsCount();
    const targets = this.getTargets();
    const { allowed, forced } = this.getAllowedTypes();
    
    let mixInstruction = '';
    if (this.config.mode === 'real') {
      if (isTechRole) {
        mixInstruction = `- MUST ask exactly 12 questions total: 6 technical, 3 behavioral, and 3 coding.
- Progress tracker: tech:${typeCounts.technical}/6 behavioral:${typeCounts.behavioral}/3 coding:${typeCounts.coding}/3 total:${totalAsked}/12
- If total reaches 12, you MUST return end_session.`;
      } else {
        mixInstruction = `- MUST ask exactly 12 questions total: 8 skill-based and 4 behavioral/HR.
- Progress tracker: technical:${typeCounts.technical}/8 behavioral:${typeCounts.behavioral}/4 total:${totalAsked}/12
- If total reaches 12, you MUST return end_session.`;
      }
    } else {
      mixInstruction = `- Target question mix: Technical ${targets.tech}, Behavioral ${targets.hr}, Coding ${targets.code} (total ${targets.total} unskipped questions).
- Progress tracker: tech:${typeCounts.technical}/${targets.tech} behavioral:${typeCounts.behavioral}/${targets.hr} coding:${typeCounts.coding}/${targets.code} total:${totalAsked}/${targets.total}
- End the session after exactly ${targets.total} unskipped questions have been answered.`;
    }

    // Build hard constraints for which types are allowed/forbidden
    const typeConstraints: string[] = [];
    if (targets.tech === 0) typeConstraints.push('- NEVER ask technical questions. The user set technical to 0%.');
    if (targets.hr === 0) typeConstraints.push('- NEVER ask behavioral/situational questions. The user set behavioral to 0%.');
    if (targets.code === 0) typeConstraints.push('- NEVER ask coding questions. The user set coding to 0%.');
    if (forced) typeConstraints.push(`- You MUST ask a "${forced}" question next. All other quotas are met.`);
    if (allowed.length > 0 && !forced) typeConstraints.push(`- For the next question, choose from these types ONLY: ${allowed.join(', ')}.`);
    const constraintsBlock = typeConstraints.length > 0 ? '\n' + typeConstraints.join('\n') : '';

    // Restrict the valid questionType values in the output format to only the 3 canonical types
    const validTypes = 'behavioral|technical|coding';

    const askedQuestionsSummary = this.contextManager.getFullHistory()
      .filter(t => !t.followUpAsked)
      .map(t => `- ID: ${t.questionId} | Question: ${t.question}`)
      .join('\n');

    return `You are a senior ${this.contextManager.getJobProfile()} interviewer at a top tech company. You are conducting a structured interview.

YOUR PERSONA:
- Professional but warm. You want the candidate to succeed.
- You ask precise, targeted questions. Never vague or generic.
- You reference the candidate's resume to ask specific, personalized questions.
- You probe for depth — if an answer is surface-level, ask a follow-up.

INTERVIEW RULES:
- Ask ONE question at a time. Never ask multiple questions.
${mixInstruction}${constraintsBlock}
- Reference the candidate's specific projects, skills, and experience from their resume.
- If =UNCOVERED_TOPICS= shows resume items not yet discussed, prioritize asking about them.
- After each answer, decide: follow up (if vague/incomplete) OR move to next topic.
- Consecutive follow-up limit: You can ask at most ${this.MAX_CONSECUTIVE_FOLLOWUPS} consecutive follow-up questions for a given topic.
- Current status: You have asked ${this.consecutiveFollowUps} consecutive follow-up questions.
${this.consecutiveFollowUps >= this.MAX_CONSECUTIVE_FOLLOWUPS ? '- CRITICAL: You have reached the limit of consecutive follow-ups. You MUST ask a NEW question on a DIFFERENT topic now. Set isFollowUp to false, use a new question_id, and change the topic completely.' : '- You may ask a follow-up (set isFollowUp: true) if the candidate\'s answer was vague or incomplete, or move to a new topic (set isFollowUp: false).'}
- If the candidate skipped the previous question (i.e. =LAST_ANSWER= is "(skipped)"), do NOT ask a follow-up. You MUST move to a completely new topic or question type (set isFollowUp: false).
- CRITICAL: Never repeat a question or ask about a concept/topic you have already covered. Review the list of already asked main questions:
${askedQuestionsSummary || 'None yet.'}
- If =LIVE_SIGNALS= shows nervousness/fear, be encouraging ("Take your time, you're doing well.").
- If speaking too fast (>170 WPM), gently suggest slowing down.
- If filler density is high (>5%), note it subtly.

CODING QUESTIONS:
- Coding questions must be solvable in JavaScript since the coding playground only executes JavaScript. The candidate will write JavaScript/TypeScript code. Therefore, ask coding questions that can be solved and evaluated in JavaScript.
- For coding questions, you MUST include "testCases" — an array of {"input": "...", "expectedOutput": "...", "description": "..."}.
- Make coding questions relevant to the job role and candidate's skill set.
- Include 2-3 test cases: 1 basic, 1 edge case, 1 moderate.
- Crucially, the "testCases" must have:
  - "input": A JSON-serializable string representing the input argument(s). If the function takes multiple arguments, "input" must be a JSON array of those arguments (e.g. "[[1, 2, 3], 5]"). If it takes a single argument, it can be a JSON string, number, array, or object (e.g., "[1, 2, 3]" or "5" or "\"hello\"").
  - "expectedOutput": A JSON-serializable string representing the expected return value of the function (e.g. "8" or "\"olleh\"" or "[2, 4, 6]").
  - "description": A short explanation of the test case.
- After the candidate writes code, ask 1-2 follow-up questions about time complexity, trade-offs, or alternative approaches. Mark these with isFollowUp: true.
- If =CODE_WRITTEN= is present, evaluate the code and ask about it. If =TEST_RESULTS= shows failures, ask the candidate to fix or explain.

FOLLOW-UPS:
- A follow-up is when you want to dig deeper into the SAME topic.
- Set isFollowUp: true and keep the same questionType.
- Use follow-ups when: the answer was vague, the code had issues, or you want to explore a mentioned concept deeper.

OUTPUT FORMAT — You MUST respond with exactly ONE JSON object:

{"type":"ask_question","question":"Your question here","question_id":"descriptive_slug","questionType":"${validTypes}","isFollowUp":false,"expectedPoints":["point1","point2"],"testCases":[{"input":"...","expectedOutput":"...","description":"..."}]}

CRITICAL RULES FOR questionType:
- Use ONLY one of: "technical", "behavioral", "coding".
- Do NOT use "resume_specific" or "situational" — those are NOT valid.
- Resume-related technical questions should use questionType: "technical".
- Situational/HR questions should use questionType: "behavioral".

Notes:
- testCases is REQUIRED for coding questions, omit for other types.
- expectedPoints should list 2-4 key points you expect in a good answer.
- question_id should be a short descriptive slug like "react_state_mgmt" or "system_design_cache".
- isFollowUp should be true only for follow-up questions on the same topic.

To end the session:
{"type":"end_session","reason":"All planned questions completed","finalImpression":"2-3 sentence summary of candidate performance"}`;
  }

  /**
   * Get the next action from the Gemini orchestrator.
   */
  async getNextAction(
    lastAnswerTranscript?: string,
    lastScores?: {
      quality: number;
      sentiment: string;
      fillerDensity: number;
    },
    liveSignals?: LiveSignals
  ): Promise<AgentAction> {
    const targets = this.getTargets();
    const unskippedCount = this.contextManager.getUnskippedMainQuestionsCount();

    if (unskippedCount >= targets.total) {
      return {
        type: 'end_session',
        reason: 'All planned questions completed',
        finalImpression: `The candidate has successfully answered all ${targets.total} required questions.`
      };
    }

    if (lastAnswerTranscript === '(skipped)') {
      this.consecutiveFollowUps = 0;
    }

    const context = this.contextManager.buildGeminiContext(liveSignals);

    const userMessage = lastAnswerTranscript
      ? `${context}\n\n=LAST_ANSWER= ${lastAnswerTranscript.slice(0, 800)}\n=SCORES= quality:${lastScores?.quality}/10 sentiment:${lastScores?.sentiment} fillers:${lastScores?.fillerDensity}%`
      : `${context}\n\nBegin the interview. Greet the candidate by name (from resume) and ask your first question. Make it a warm, specific opening based on their background.`;

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'interview_turn',
          content: userMessage,
          instruction: this.getSystemPrompt(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const parsed = this.parseAgentResponse(data.text);

      if (parsed.type === 'ask_question' && parsed.expectedPoints) {
        this.currentExpectedPoints = parsed.expectedPoints;
      }

      // Track question count and consecutive follow-ups
      if (parsed.type === 'ask_question') {
        if (parsed.isFollowUp) {
          this.consecutiveFollowUps++;
        } else {
          this.consecutiveFollowUps = 0;
          this.questionCounter++;
        }
      }

      return parsed;
    } catch (error) {
      console.error('Gemini agent error:', error);
      return {
        type: 'ask_question',
        question: 'Can you tell me about a challenging project you worked on recently and what made it challenging?',
        question_id: `fallback_${this.questionCounter + 1}`,
        questionType: 'behavioral',
        isFollowUp: false,
        expectedPoints: ['Clear problem description', 'Actions taken', 'Results achieved'],
      };
    }
  }

  /** Parse the raw Gemini response into a typed AgentAction */
  private parseAgentResponse(rawText: string): AgentAction {
    try {
      let text = rawText.trim();
      if (text.startsWith('```')) {
        text = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      const parsed = JSON.parse(text);
      
      let enforcedIsFollowUp = parsed.isFollowUp === true;
      if (enforcedIsFollowUp && this.consecutiveFollowUps >= this.MAX_CONSECUTIVE_FOLLOWUPS) {
        enforcedIsFollowUp = false;
      }

      // Enforce question type against the user's split targets if it's a main question
      const enforcedType = parsed.type === 'ask_question' && !enforcedIsFollowUp
        ? this.enforceQuestionType(parsed.questionType)
        : this.normalizeQuestionType(parsed.questionType);

      return {
        type: parsed.type || 'ask_question',
        question: parsed.question,
        question_id: parsed.question_id || `q_${this.questionCounter + 1}`,
        questionType: enforcedType,
        isFollowUp: enforcedIsFollowUp,
        reason: parsed.reason,
        topic: parsed.topic,
        finalImpression: parsed.finalImpression,
        expectedPoints: parsed.expectedPoints,
        testCases: parsed.testCases,
      };
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          let enforcedIsFollowUp = parsed.isFollowUp === true;
          if (enforcedIsFollowUp && this.consecutiveFollowUps >= this.MAX_CONSECUTIVE_FOLLOWUPS) {
            enforcedIsFollowUp = false;
          }

          const enforcedType = parsed.type === 'ask_question' && !enforcedIsFollowUp
            ? this.enforceQuestionType(parsed.questionType)
            : this.normalizeQuestionType(parsed.questionType);

          return {
            type: parsed.type || 'ask_question',
            question: parsed.question,
            question_id: parsed.question_id || `q_${this.questionCounter + 1}`,
            questionType: enforcedType,
            isFollowUp: enforcedIsFollowUp,
            expectedPoints: parsed.expectedPoints,
            testCases: parsed.testCases,
            reason: parsed.reason,
            topic: parsed.topic,
            finalImpression: parsed.finalImpression,
          };
        } catch {
          // Fall through
        }
      }

      // Fallback: use enforced type
      const { allowed } = this.getAllowedTypes();
      const fallbackType = allowed.length > 0 ? allowed[0] : 'behavioral';
      return {
        type: 'ask_question',
        question: rawText.length > 10 ? rawText : 'Tell me about your most impactful work experience and what you learned from it.',
        question_id: `parsed_fallback_${this.questionCounter + 1}`,
        questionType: fallbackType,
        isFollowUp: false,
      };
    }
  }

  getCurrentExpectedPoints(): string[] {
    return this.currentExpectedPoints;
  }
  
  getQuestionCount(): number {
    return this.questionCounter;
  }
}
