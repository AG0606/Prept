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
  private cachedResumeQuestions: Array<{ question: string; questionType?: string; expectedPoints?: string[]; description?: string }> = [];
  private usedCachedQuestionIndices = new Set<number>();

  constructor(contextManager: ContextManager, config: InterviewConfig) {
    this.contextManager = contextManager;
    this.config = config;
  }

  /** Set pre-generated resume-specific questions cached in the database */
  setCachedQuestions(questions: Array<{ question: string; questionType?: string; expectedPoints?: string[]; description?: string }>) {
    if (Array.isArray(questions)) {
      this.cachedResumeQuestions = questions;
    }
  }

  /** Retrieve an unused cached resume question if available */
  getNextCachedResumeQuestion(): { question: string; questionType: QuestionCategory; expectedPoints?: string[] } | null {
    for (let i = 0; i < this.cachedResumeQuestions.length; i++) {
      if (!this.usedCachedQuestionIndices.has(i)) {
        this.usedCachedQuestionIndices.add(i);
        const item = this.cachedResumeQuestions[i];
        return {
          question: item.question,
          questionType: 'technical',
          expectedPoints: item.expectedPoints || ['Clear architecture reasoning', 'Technical trade-offs', 'Concrete production metrics'],
        };
      }
    }
    return null;
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

    // If nothing is left (all targets met), allow end_session
    if (allowed.length === 0) return { allowed: [], forced: null };
    if (allowed.length === 1) return { allowed, forced: allowed[0] };
    return { allowed, forced: null };
  }

  /** Get the numerical targets for each question category */
  private getTargets(): { tech: number; hr: number; code: number; total: number } {
    if (this.config.mode === 'real') {
      return { tech: 8, hr: 4, code: 0, total: 12 };
    }
    // Practice mode — derive from 2-way splits
    const total = 12;
    const tech = Math.round(total * this.config.techSplit / 100);
    const hr = Math.max(0, total - tech);
    return { tech, hr, code: 0, total };
  }

  /**
   * Normalize a questionType returned by Gemini into the 2 canonical categories.
   * resume_specific / situational / coding / unknown → mapped to "technical" or "behavioral".
   */
  private normalizeQuestionType(raw: string | undefined): QuestionCategory {
    if (!raw) return 'behavioral';
    const lower = raw.toLowerCase().trim();
    if (lower === 'technical' || lower === 'coding') return 'technical';
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
        const key = t === 'technical' ? 'tech' : 'hr';
        const countKey = t;
        return { type: t, room: targets[key] - (counts[countKey] || 0) };
      });
      remaining.sort((a, b) => b.room - a.room);
      return remaining[0].type;
    }
    return normalized;
  }

  private getSystemPrompt(): string {
    const typeCounts = this.contextManager.getQuestionTypeCounts();
    const totalAsked = this.contextManager.getUnskippedMainQuestionsCount();
    const targets = this.getTargets();
    const { allowed, forced } = this.getAllowedTypes();
    
    let mixInstruction = '';
    if (this.config.mode === 'real') {
      mixInstruction = `- MUST ask exactly 12 questions total: 8 technical/skills and 4 behavioral/HR.
- Progress tracker: technical:${typeCounts.technical}/8 behavioral:${typeCounts.behavioral}/4 total:${totalAsked}/12
- If total reaches 12, you MUST return end_session.`;
    } else {
      mixInstruction = `- Target question mix: Technical ${targets.tech}, Behavioral ${targets.hr} (total ${targets.total} unskipped questions).
- Progress tracker: tech:${typeCounts.technical}/${targets.tech} behavioral:${typeCounts.behavioral}/${targets.hr} total:${totalAsked}/${targets.total}
- End the session after exactly ${targets.total} unskipped questions have been answered.`;
    }

    // Build hard constraints for which types are allowed/forbidden
    const typeConstraints: string[] = [];
    if (targets.tech === 0) typeConstraints.push('- NEVER ask technical questions. The user set technical to 0%.');
    if (targets.hr === 0) typeConstraints.push('- NEVER ask behavioral/situational questions. The user set behavioral to 0%.');
    if (forced) typeConstraints.push(`- You MUST ask a "${forced}" question next. All other quotas are met.`);
    if (allowed.length > 0 && !forced) typeConstraints.push(`- For the next question, choose from these types ONLY: ${allowed.join(', ')}.`);
    const constraintsBlock = typeConstraints.length > 0 ? '\n' + typeConstraints.join('\n') : '';

    // Restrict the valid questionType values in the output format to only technical and behavioral
    const validTypes = 'behavioral|technical';

    // The =HISTORY= section in buildGeminiContext already tracks asked questions,
    // so we don't duplicate them here to save ~150-300 tokens per turn.

    const persona = this.contextManager.getInterviewerPersona();
    let personaStyle = '';
    if (persona === 'faang') {
      personaStyle = `YOUR PERSONA — BIG TECH / FAANG PRINCIPAL INTERVIEWER:
- Highly rigorous, analytical, and scale-focused.
- You care deeply about massive scale (millions of RPS, distributed architectures, high availability, edge cases).
- In behavioral questions, you strictly evaluate against the STAR framework and leadership principles (ownership, dive deep, customer obsession).
- You probe metrics and quantitative impact (e.g. "What was the exact latency reduction or throughput increase?").`;
    } else if (persona === 'startup') {
      personaStyle = `YOUR PERSONA — HIGH-GROWTH STARTUP VP OF ENGINEERING:
- Fast-paced, pragmatic, and ownership-driven.
- You value end-to-end execution, bias for action, full-stack pragmatism, and thriving in ambiguity.
- You care about speed to production, maintainability, and practical engineering trade-offs over theoretical perfection.`;
    } else if (persona === 'challenger') {
      personaStyle = `YOUR PERSONA — CHALLENGER & DEEP PROBE INTERVIEWER:
- Direct, incisive, and rigorous. You test the candidate's conviction and depth.
- When they propose a solution, push back: "Why not choose technology X instead?" or "What breaks when traffic spikes 100x?"
- Never accept buzzwords without concrete technical explanation.`;
    } else {
      personaStyle = `YOUR PERSONA — SENIOR ENGINEERING INTERVIEWER:
- Professional, structured, and warm. You want the candidate to succeed.
- You ask precise, targeted questions. Never vague or generic.
- You probe for depth — if an answer is surface-level, ask a follow-up.`;
    }

    return `You are a senior ${this.contextManager.getJobProfile()} interviewer conducting a high-fidelity interview.

${personaStyle}

INTERVIEW RULES:
- Ask ONE question at a time. Never ask multiple questions.
${mixInstruction}${constraintsBlock}
- Reference the candidate's specific projects, skills, and experience from their resume.
- If =TARGET_JOB_DESCRIPTION= and =COMPETENCY_GAPS= are present in context, actively prioritize asking questions that probe the target JD requirements and test the candidate's identified gaps.
- If =UNCOVERED_TOPICS= shows resume items not yet discussed, prioritize asking about them.
- After each answer, decide: follow up (if vague/incomplete) OR move to next topic.
- Consecutive follow-up limit: You can ask at most ${this.MAX_CONSECUTIVE_FOLLOWUPS} consecutive follow-up questions for a given topic.
- Current status: You have asked ${this.consecutiveFollowUps} consecutive follow-up questions.
${this.consecutiveFollowUps >= this.MAX_CONSECUTIVE_FOLLOWUPS ? '- CRITICAL: You have reached the limit of consecutive follow-ups. You MUST ask a NEW question on a DIFFERENT topic now. Set isFollowUp to false, use a new question_id, and change the topic completely.' : '- You may ask a follow-up (set isFollowUp: true) if the candidate\'s answer was vague or incomplete, or move to a new topic (set isFollowUp: false).'}
- If the candidate skipped the previous question (i.e. =LAST_ANSWER= is "(skipped)"), do NOT ask a follow-up. You MUST move to a completely new topic or question type (set isFollowUp: false).
- CRITICAL: Never repeat a question or ask about a concept/topic you have already covered. Check =HISTORY= for previously asked questions.
- If =LIVE_SIGNALS= shows nervousness/fear, be encouraging ("Take your time, you're doing well.").
- If speaking too fast (>170 WPM), gently suggest slowing down.
- If filler density is high (>5%), note it subtly.

FOLLOW-UPS:
- A follow-up is when you want to dig deeper into the SAME topic.
- Set isFollowUp: true and keep the same questionType.
- Use follow-ups when: the answer was vague or you want to explore a mentioned concept deeper.

OUTPUT FORMAT — You MUST respond with exactly ONE JSON object:

{"type":"ask_question","question":"Your question here","question_id":"descriptive_slug","questionType":"${validTypes}","isFollowUp":false,"expectedPoints":["point1","point2"]}

CRITICAL RULES FOR questionType:
- Use ONLY one of: "technical", "behavioral".
- Do NOT use "coding", "resume_specific", or "situational" — those are NOT valid.
- Resume-related technical questions should use questionType: "technical".
- Situational/HR questions should use questionType: "behavioral".

Notes:
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
      ? `=LAST_ANSWER= ${lastAnswerTranscript.slice(0, 800)}\n=SCORES= quality:${lastScores?.quality}/10 sentiment:${lastScores?.sentiment} fillers:${lastScores?.fillerDensity}%`
      : `Begin the interview. Greet the candidate by name (from resume) and ask your first question. Make it a warm, specific opening based on their background.`;

    const fullInstruction = `${this.getSystemPrompt()}\n\nINTERVIEW CONTEXT:\n${context}`;

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'interview_turn',
          content: userMessage,
          instruction: fullInstruction,
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

  /**
   * Get the system prompt and context for the unified /api/agent-turn route.
   * This lets the interview page call one route that handles scoring + next question.
   */
  getPromptAndContext(liveSignals?: LiveSignals): { systemPrompt: string; context: string } {
    const context = this.contextManager.buildGeminiContext(liveSignals);
    return {
      systemPrompt: this.getSystemPrompt(),
      context,
    };
  }

  /**
   * Process the unified API response and apply agent-side logic
   * (follow-up tracking, type enforcement, expected points caching).
   */
  processUnifiedResponse(nextAction: any): import('@/types').AgentAction {
    if (!nextAction || nextAction.type === 'end_session') {
      return {
        type: 'end_session',
        reason: nextAction?.reason || 'Session ended',
        finalImpression: nextAction?.finalImpression || 'Interview complete.',
      };
    }

    let enforcedIsFollowUp = nextAction.isFollowUp === true;
    if (enforcedIsFollowUp && this.consecutiveFollowUps >= this.MAX_CONSECUTIVE_FOLLOWUPS) {
      enforcedIsFollowUp = false;
    }

    const enforcedType = !enforcedIsFollowUp
      ? this.enforceQuestionType(nextAction.questionType)
      : this.normalizeQuestionType(nextAction.questionType);

    if (nextAction.expectedPoints) {
      this.currentExpectedPoints = nextAction.expectedPoints;
    }

    if (enforcedIsFollowUp) {
      this.consecutiveFollowUps++;
    } else {
      this.consecutiveFollowUps = 0;
      this.questionCounter++;
    }

    return {
      type: 'ask_question',
      question: nextAction.question,
      question_id: nextAction.question_id || `q_${this.questionCounter}`,
      questionType: enforcedType,
      isFollowUp: enforcedIsFollowUp,
      expectedPoints: nextAction.expectedPoints,
      testCases: nextAction.testCases,
      reason: nextAction.reason,
      topic: nextAction.topic,
      finalImpression: nextAction.finalImpression,
    };
  }

  /** Check if the session should end based on question counts */
  shouldEndSession(): boolean {
    const targets = this.getTargets();
    const unskippedCount = this.contextManager.getUnskippedMainQuestionsCount();
    return unskippedCount >= targets.total;
  }
}
