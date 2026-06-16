import { estimateTokens, trimToTokenBudget, TOKEN_BUDGETS } from './tokenCounter';
import type { ResumeData, TurnSummary, SessionContext, LiveSignals, QuestionCategory } from '@/types';

export class ContextManager {
  private ctx: SessionContext;
  private resumeData: ResumeData;

  constructor(resume: ResumeData, jobProfile: string) {
    this.resumeData = resume;
    this.ctx = {
      resumeSnapshot: this.compressResume(resume),
      jobProfile,
      turns: [],
      openThreads: [],
      askedQuestions: new Set<string>(),
      totalTokensUsed: 0,
    };
  }

  /** Compress resume — keep most relevant facts within token budget */
  private compressResume(r: ResumeData): string {
    const parts: string[] = [];
    parts.push(`NAME:${r.name}`);
    
    // Experience - include all with concise format
    if (r.experience?.length > 0) {
      const exp = r.experience
        .slice(0, 4)
        .map((e) => `${e.role}@${e.company}(${e.duration}):${e.bullets.slice(0, 2).join('; ')}`)
        .join(' | ');
      parts.push(`EXP:${exp}`);
    }
    
    // Skills - include all up to budget
    if (r.skills?.length > 0) {
      parts.push(`SKILLS:${r.skills.slice(0, 20).join(', ')}`);
    }
    
    // Education
    if (r.education?.length > 0) {
      const edu = r.education.map((e) => `${e.degree}@${e.institution}(${e.year})`).join('; ');
      parts.push(`EDU:${edu}`);
    }
    
    // Projects with tech stacks
    if (r.projects?.length > 0) {
      const proj = r.projects
        .slice(0, 4)
        .map((p) => `${p.name}[${p.tech?.join(',') || 'N/A'}]:${p.description?.slice(0, 60) || ''}`)
        .join(' | ');
      parts.push(`PROJ:${proj}`);
    }
    
    return parts.join(' || ');
  }

  /** Called after each answer is fully processed */
  addTurn(turn: TurnSummary) {
    this.ctx.turns.push(turn);
    this.ctx.askedQuestions.add(turn.questionId);

    // If gaps detected, add to open threads (deduplicated)
    if (turn.gaps.length > 0) {
      for (const gap of turn.gaps) {
        if (!this.ctx.openThreads.includes(gap)) {
          this.ctx.openThreads.push(gap);
        }
      }
    }
    // If this was a follow-up, try to resolve the first open thread
    if (turn.followUpAsked && this.ctx.openThreads.length > 0) {
      this.ctx.openThreads.shift();
    }
  }

  /** Get counts of each question type asked so far.
   *  Normalizes resume_specific → technical and situational → behavioral
   *  to match the 3-bucket split system (tech / hr / coding).
   */
  getQuestionTypeCounts(): Record<string, number> {
    const counts: Record<string, number> = {
      technical: 0,
      behavioral: 0,
      coding: 0,
    };
    for (const turn of this.ctx.turns) {
      if (turn.followUpAsked) continue;
      if (turn.answerSummary === '(skipped)') continue;
      let type = turn.questionType || 'behavioral';
      // Normalize to 3 canonical categories
      if (type === 'resume_specific') type = 'technical';
      if (type === 'situational') type = 'behavioral';
      if (!counts.hasOwnProperty(type)) type = 'behavioral';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  /** Identify resume topics not yet probed */
  getResumeTopicsNotYetCovered(): string[] {
    const uncovered: string[] = [];
    const allQuestionsText = this.ctx.turns.map(t => t.question.toLowerCase()).join(' ');
    
    // Check if projects were discussed
    for (const project of this.resumeData.projects || []) {
      if (!allQuestionsText.includes(project.name.toLowerCase())) {
        uncovered.push(`Project: ${project.name}`);
      }
    }
    
    // Check if experience roles were discussed
    for (const exp of this.resumeData.experience || []) {
      if (!allQuestionsText.includes(exp.company.toLowerCase()) && 
          !allQuestionsText.includes(exp.role.toLowerCase())) {
        uncovered.push(`Role: ${exp.role} at ${exp.company}`);
      }
    }
    
    // Check key skills
    const topSkills = (this.resumeData.skills || []).slice(0, 5);
    for (const skill of topSkills) {
      if (!allQuestionsText.includes(skill.toLowerCase())) {
        uncovered.push(`Skill: ${skill}`);
      }
    }
    
    return uncovered.slice(0, 5); // Return top 5 uncovered
  }

  /** Build the compressed context string to send to Gemini */
  buildGeminiContext(liveSignals?: LiveSignals): string {
    const history = this.getCompressedHistory();
    const threads = this.ctx.openThreads.slice(0, 3).join(', ');
    const typeCounts = this.getQuestionTypeCounts();
    const uncovered = this.getResumeTopicsNotYetCovered();

    const parts = [
      `=RESUME= ${trimToTokenBudget(this.ctx.resumeSnapshot, TOKEN_BUDGETS.RESUME_CONTEXT)}`,
      `=ROLE= ${this.ctx.jobProfile}`,
      `=HISTORY= ${trimToTokenBudget(history, TOKEN_BUDGETS.CONVERSATION_HISTORY)}`,
      `=QUESTION_COUNTS= tech:${typeCounts.technical} behavioral:${typeCounts.behavioral} coding:${typeCounts.coding} total:${this.ctx.turns.length}`,
      threads ? `=OPEN_THREADS= ${threads}` : '',
      uncovered.length > 0 ? `=UNCOVERED_TOPICS= ${uncovered.join('; ')}` : '',
    ];

    // Include live signals so the AI can adapt to the candidate's state
    if (liveSignals) {
      const signalParts: string[] = [];
      if (liveSignals.dominantEmotion) {
        signalParts.push(`emotion:${liveSignals.dominantEmotion}`);
      }
      if (liveSignals.wpm !== undefined) {
        signalParts.push(`pace:${liveSignals.wpm}WPM`);
      }
      if (liveSignals.loudnessDb !== undefined) {
        signalParts.push(`volume:${Math.round(liveSignals.loudnessDb)}dB`);
      }
      if (liveSignals.fillerDensity !== undefined) {
        signalParts.push(`fillers:${liveSignals.fillerDensity.toFixed(1)}%`);
      }
      if (signalParts.length > 0) {
        parts.push(`=LIVE_SIGNALS= ${signalParts.join(' | ')}`);
      }
      // Include code playground content if present
      if (liveSignals.codeContent) {
        parts.push(`=CODE_WRITTEN= \n${trimToTokenBudget(liveSignals.codeContent, 200)}`);
      }
      if (liveSignals.codeOutput) {
        parts.push(`=CODE_OUTPUT= ${trimToTokenBudget(liveSignals.codeOutput, 100)}`);
      }
      if (liveSignals.codeTestResults) {
        let testStr = `=TEST_RESULTS= passed:${liveSignals.codeTestResults.passed}/${liveSignals.codeTestResults.total}`;
        if (liveSignals.codeTestResults.details) {
          const failed = liveSignals.codeTestResults.details.filter(d => !d.passed);
          if (failed.length > 0) {
            testStr += ' FAILURES: ' + failed.map(f => `input(${f.input})->got(${f.actual}) expected(${f.expected})`).join('; ');
          }
        }
        parts.push(testStr);
      }
    }

    const context = parts.filter(Boolean).join('\n');
    this.ctx.totalTokensUsed += estimateTokens(context);
    return context;
  }

  /** Compress full turn history into a rolling summary */
  private getCompressedHistory(): string {
    if (this.ctx.turns.length === 0) return 'No turns yet.';

    // Keep last 3 turns verbatim, summarize earlier ones
    const recent = this.ctx.turns.slice(-3);
    const older = this.ctx.turns.slice(0, -3);

    const olderSummary =
      older.length > 0
        ? `[Earlier ${older.length} questions: covered ${older.map((t) => `${t.questionId}(${t.questionType})`).join(', ')}. Avg quality: ${(older.reduce((s, t) => s + t.scores.quality, 0) / older.length).toFixed(1)}/10] `
        : '';

    const recentStr = recent
      .map(
        (t) =>
          `[${t.questionType}] Q:${t.question.slice(0, 100)} | A:${t.answerSummary} | score:${t.scores.quality}/10 | sentiment:${t.scores.sentiment}`
      )
      .join(' || ');

    return olderSummary + recentStr;
  }

  /** Summarize an answer to ~250 chars */
  static summarizeAnswer(fullTranscript: string): string {
    if (!fullTranscript || fullTranscript.trim().length === 0) return '(no answer)';
    const cleaned = fullTranscript.trim();
    if (cleaned.length <= 250) return cleaned;
    
    // Try to break at sentence boundaries
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length <= 2) return cleaned.slice(0, 250) + '...';
    
    // Take first 2 sentences + last sentence
    let summary = sentences[0].trim() + ' ' + sentences[1].trim();
    if (summary.length < 200) {
      summary += ' ... ' + sentences[sentences.length - 1].trim();
    }
    return summary.slice(0, 250);
  }

  getOpenThreads(): string[] {
    return this.ctx.openThreads;
  }

  getAskedCount(): number {
    return this.ctx.turns.length;
  }

  getMainQuestionsCount(): number {
    return this.ctx.turns.filter(t => !t.followUpAsked).length;
  }

  getUnskippedMainQuestionsCount(): number {
    return this.ctx.turns.filter(t => !t.followUpAsked && t.answerSummary !== '(skipped)').length;
  }

  getFullHistory(): TurnSummary[] {
    return this.ctx.turns;
  }

  getTokenUsage(): number {
    return this.ctx.totalTokensUsed;
  }

  getJobProfile(): string {
    return this.ctx.jobProfile;
  }

  getResumeSnapshot(): string {
    return this.ctx.resumeSnapshot;
  }
}
