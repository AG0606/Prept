// ════════════════════════════════════════════════════════════
// AI Interview Coach — Shared Type Definitions
// ════════════════════════════════════════════════════════════

// ── Resume Types ─────────────────────────────────────────────

export interface ResumeData {
  name: string;
  email: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  rawText: string;
  rating?: number;       // AI-evaluated resume strength 1-10
  suggestions?: string;  // AI improvement suggestions
}

export interface ExperienceEntry {
  company: string;
  role: string;
  duration: string;
  bullets: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  year: string;
}

export interface ProjectEntry {
  name: string;
  description: string;
  tech: string[];
}

// ── Emotion / Audio Types ────────────────────────────────────

export type EmotionLabel = 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised';

export interface EmotionReading {
  dominant: string;
  scores: Record<string, number>;
  timestamp: number;
}

export interface AudioMetrics {
  loudnessDb: number; // -60 to 0
  wordsPerMinute: number;
  timestamp: number;
}

// ── Filler Detection ─────────────────────────────────────────

export interface FillerResult {
  count: number;
  words: string[];
  density: number; // fillers per 100 words
}

// ── Quality Scoring ──────────────────────────────────────────

export interface QualityScore {
  score: number; // 0–10
  starScore: number; // 0–4 (Situation/Task/Action/Result)
  completeness: number; // 0–1
  relevance: number; // 0–1
  feedback: string;
}

// ── Coding / Test Cases ──────────────────────────────────────

export interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
}

export interface CodeTestResults {
  passed: number;
  total: number;
  details: { input: string; expected: string; actual: string; passed: boolean }[];
}

// ── Question Categories ─────────────────────────────────────

export type QuestionCategory = 'behavioral' | 'technical' | 'resume_specific' | 'situational' | 'coding';

// ── Context Manager / Turn ──────────────────────────────────

export interface TurnSummary {
  questionId: string;
  question: string;
  questionType: QuestionCategory;
  answerSummary: string; // compressed, not full transcript
  fullAnswer?: string;   // the raw transcript
  scores: {
    quality: number;
    sentiment: string;
    fillerDensity: number;
    dominantEmotion: string;
    wpm: number;
    codeTestResults?: CodeTestResults;
  };
  gaps: string[]; // topics not covered
  followUpAsked: boolean;
}

export interface SessionContext {
  resumeSnapshot: string; // compressed resume facts
  jobProfile: string;
  turns: TurnSummary[];
  openThreads: string[]; // topics to follow up on
  askedQuestions: Set<string>;
  totalTokensUsed: number;
}

/** Live signals from browser sensors, passed to Gemini context */
export interface LiveSignals {
  dominantEmotion?: string;
  wpm?: number;
  loudnessDb?: number;
  fillerDensity?: number;
  codeContent?: string;  // current code in playground
  codeOutput?: string;   // last execution output
  codeTestResults?: CodeTestResults; // test case results
}

// ── Gemini Agent ─────────────────────────────────────────────

export interface AgentAction {
  type: 'ask_question' | 'followup' | 'detect_gap' | 'end_session';
  question?: string;
  question_id?: string;
  questionType?: QuestionCategory;
  isFollowUp?: boolean;
  reason?: string;
  topic?: string;
  finalImpression?: string;
  expectedPoints?: string[];
  testCases?: TestCase[];
}

// ── Report ───────────────────────────────────────────────────

export interface SessionReport {
  candidateName: string;
  jobRole: string;
  date: string;
  duration: number; // minutes
  turns: TurnSummary[];
  emotionTimeline: EmotionPoint[];
  audioMetrics: AudioSummary;
  overallScores: OverallScores;
  geminiImpression: string;
  recommendations: string[];
}

export interface EmotionPoint {
  timestamp: number;
  emotion: string;
}

export interface AudioSummary {
  avgWpm: number;
  avgLoudnessDb: number;
}

export interface OverallScores {
  communication: number; // 0–10
  confidence: number; // 0–10
  technicalDepth: number; // 0–10
  structure: number; // 0–10
  overall: number; // 0–10
}

// ── Interview Store ──────────────────────────────────────────

export type InterviewPhase = 'setup' | 'interviewing' | 'complete';

export interface CodeRunResult {
  stdout: string;
  stderr: string;
  executionTime: number;
  code: string;
}
