// ════════════════════════════════════════════════════════════
// Zustand Interview Store — Global Session State
// ════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { TurnSummary, EmotionReading, InterviewPhase, ResumeData, CodeTestResults } from '@/types';

interface InterviewState {
  // Session metadata
  sessionId: string;
  jobProfile: string;
  resumeData: ResumeData | null;
  isActive: boolean;
  phase: InterviewPhase;
  sessionStartTime: number;
  mode: 'real' | 'practice';
  techSplit: number;
  hrSplit: number;
  codeSplit: number;

  // Current turn
  currentQuestion: string;
  currentQuestionId: string;
  currentQuestionType: string;
  currentQuestionIsFollowUp: boolean;
  currentTestCases: import('@/types').TestCase[];
  transcript: string;
  currentCode: string;
  codeTestResults: CodeTestResults | null;
  isListening: boolean;
  isSpeaking: boolean;

  // Live signals
  currentEmotion: EmotionReading | null;
  loudnessDb: number;
  wordsPerMinute: number;
  fillerCount: number;
  fillerDensity: number;
  sentimentLabel: string;
  qualityScore: number;

  // Session history
  turns: TurnSummary[];
  emotionHistory: EmotionReading[];
  transcriptWordCount: number;

  // Actions
  setJobProfile: (jp: string) => void;
  setResumeData: (r: ResumeData) => void;
  setMode: (mode: 'real' | 'practice') => void;
  setSplits: (tech: number, hr: number, code: number) => void;
  startSession: () => void;
  setCurrentQuestion: (q: string, qId: string, qType?: string, testCases?: import('@/types').TestCase[], isFollowUp?: boolean) => void;
  setTranscript: (text: string) => void;
  appendTranscript: (text: string) => void;
  setCurrentCode: (code: string) => void;
  setCodeTestResults: (results: CodeTestResults | null) => void;
  setIsListening: (v: boolean) => void;
  setIsSpeaking: (v: boolean) => void;
  setEmotion: (e: EmotionReading) => void;
  setAudioMetrics: (loudness: number, wpm: number) => void;
  setFillerCount: (n: number, density: number) => void;
  setSentiment: (label: string) => void;
  setQualityScore: (score: number) => void;
  addTurn: (turn: TurnSummary) => void;
  endSession: () => void;
  resetSession: () => void;
}

const initialState = {
  sessionId: '',
  jobProfile: '',
  resumeData: null,
  isActive: false,
  phase: 'setup' as InterviewPhase,
  sessionStartTime: 0,
  mode: 'practice' as const,
  techSplit: 50,
  hrSplit: 25,
  codeSplit: 25,
  currentQuestion: '',
  currentQuestionId: '',
  currentQuestionType: '',
  currentQuestionIsFollowUp: false,
  currentTestCases: [],
  transcript: '',
  currentCode: '',
  codeTestResults: null,
  isListening: false,
  isSpeaking: false,
  currentEmotion: null,
  loudnessDb: -60,
  wordsPerMinute: 0,
  fillerCount: 0,
  fillerDensity: 0,
  sentimentLabel: 'neutral',
  qualityScore: 0,
  turns: [],
  emotionHistory: [],
  transcriptWordCount: 0,
};

export const useInterviewStore = create<InterviewState>((set) => ({
  ...initialState,

  setJobProfile: (jp) => set({ jobProfile: jp }),
  setResumeData: (r) => set({ resumeData: r }),
  setMode: (mode) => set({ mode }),
  setSplits: (techSplit, hrSplit, codeSplit) => set({ techSplit, hrSplit, codeSplit }),
  startSession: () => {
    const sessionId = crypto.randomUUID();
    set({
      isActive: true,
      phase: 'interviewing',
      sessionId,
      sessionStartTime: Date.now(),
    });
    
    // Save session and resume to DB asynchronously
    const state = useInterviewStore.getState();
    fetch('/api/save-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        jobProfile: state.jobProfile,
        resumeData: state.resumeData,
        mode: state.mode,
        techSplit: state.techSplit,
        hrSplit: state.hrSplit,
        codeSplit: state.codeSplit
      })
    }).catch(err => console.error('Failed to save session:', err));
  },
  setCurrentQuestion: (q, qId, qType, testCases, isFollowUp) =>
    set((s) => ({
      currentQuestion: q,
      currentQuestionId: qId,
      currentQuestionType: qType || 'behavioral',
      currentQuestionIsFollowUp: isFollowUp || false,
      currentTestCases: testCases || [],
      transcript: '',
      transcriptWordCount: 0,
      codeTestResults: isFollowUp ? s.codeTestResults : null,
      currentCode: (qType === 'coding' || isFollowUp) ? s.currentCode : '',
    })),
  setTranscript: (text) =>
    set({
      transcript: text,
      transcriptWordCount: text.split(/\s+/).filter(Boolean).length,
    }),
  appendTranscript: (text) =>
    set((s) => {
      const newTranscript = s.transcript + ' ' + text;
      return {
        transcript: newTranscript,
        transcriptWordCount: newTranscript.split(/\s+/).filter(Boolean).length,
      };
    }),
  setCurrentCode: (code) => set({ currentCode: code }),
  setCodeTestResults: (codeTestResults) => set({ codeTestResults }),
  setIsListening: (v) => set({ isListening: v }),
  setIsSpeaking: (v) => set({ isSpeaking: v }),
  setEmotion: (e) =>
    set((s) => {
      // Keep only last 1000 emotion readings to prevent unbounded memory growth
      const history = [...s.emotionHistory, e];
      if (history.length > 1000) history.shift();
      return {
        currentEmotion: e,
        emotionHistory: history,
      };
    }),
  setAudioMetrics: (loudnessDb, wordsPerMinute) =>
    set({ loudnessDb, wordsPerMinute }),
  setFillerCount: (fillerCount, fillerDensity) =>
    set({ fillerCount, fillerDensity }),
  setSentiment: (sentimentLabel) => set({ sentimentLabel }),
  setQualityScore: (qualityScore) => set({ qualityScore }),
  addTurn: (turn) => {
    set((s) => ({ turns: [...s.turns, turn] }));
    
    // Save turn to DB asynchronously using the provided turn object directly
    const state = useInterviewStore.getState();
    fetch('/api/save-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        turn
      })
    }).catch(err => console.error('Failed to save turn:', err));
  },
  endSession: () =>
    set({ isActive: false, phase: 'complete', isListening: false }),
  resetSession: () => set(initialState),
}));
