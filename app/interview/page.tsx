'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useInterviewStore } from '@/store/interviewStore';
import { ContextManager } from '@/lib/contextManager';
import { GeminiAgent } from '@/lib/geminiAgent';
import { detectFillers } from '@/lib/fillerDetector';
import { scoreResponse } from '@/lib/models/qualityScorer';
import { EmotionOverlay } from '@/components/EmotionOverlay';
import { AudioAnalyzer } from '@/components/AudioAnalyzer';
import { TranscriptDisplay } from '@/components/TranscriptDisplay';
import { ScorePanel } from '@/components/ScorePanel';
import { CodePlayground } from '@/components/CodePlayground';
import { PreptWordmark } from '@/components/PreptLogo';
import type { TurnSummary, LiveSignals } from '@/types';
import { Check, Loader2, Code as CodeIcon, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEnhancedTTS } from '@/hooks/useEnhancedTTS';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function InterviewPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ctxManagerRef = useRef<ContextManager | null>(null);
  const agentRef = useRef<GeminiAgent | null>(null);
  const hasStartedRef = useRef(false);

  const store = useInterviewStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [agentThinking, setAgentThinking] = useState(false);
  const [codingSubState, setCodingSubState] = useState<'coding' | 'followup' | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  
  const { speak, stop, voiceSelectorUI } = useEnhancedTTS();
  const { startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!store.resumeData || !store.jobProfile) {
      router.push('/');
      return;
    }

    const ctxManager = new ContextManager(store.resumeData, store.jobProfile);
    ctxManagerRef.current = ctxManager;
    
    // Pass the config to the agent
    agentRef.current = new GeminiAgent(ctxManager, {
      mode: store.mode,
      techSplit: store.techSplit,
      hrSplit: store.hrSplit,
      codeSplit: store.codeSplit
    });

    let videoElement: HTMLVideoElement | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoElement = videoRef.current;
        }
      })
      .catch((err) => console.error('Camera error:', err));

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      getNextQuestion();
    }

    return () => {
      if (videoElement?.srcObject) {
        (videoElement.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync client microphone recording with global listening state
  useEffect(() => {
    if (store.isListening) {
      startRecording();
    } else {
      if (!isSubmittingRef.current) {
        cancelRecording();
      }
    }
  }, [store.isListening, startRecording, cancelRecording]);

  const getNextQuestion = useCallback(
    async (lastTranscript?: string, lastScores?: { quality: number; sentiment: string; fillerDensity: number }) => {
      if (!agentRef.current) return;
      setAgentThinking(true);

      const signals: LiveSignals = {
        dominantEmotion: store.currentEmotion?.dominant,
        wpm: store.wordsPerMinute,
        loudnessDb: store.loudnessDb,
        fillerDensity: store.fillerDensity,
        codeContent: store.currentCode || undefined,
        codeTestResults: store.codeTestResults || undefined,
      };

      try {
        const action = await agentRef.current.getNextAction(lastTranscript, lastScores, signals);

        if (action.type === 'end_session') {
          setIsEnding(true);
          const thankYouText = "Thank you for taking the time to complete this interview. We have gathered all the necessary data. I will now generate your performance report.";
          store.setCurrentQuestion(thankYouText, 'conclusion', 'behavioral');
          speak(
            thankYouText,
            () => store.setIsSpeaking(true),
            () => {
              store.setIsSpeaking(false);
              store.endSession();
              router.push('/report');
            }
          );
          // Safety timeout fallback
          setTimeout(() => {
            const state = useInterviewStore.getState();
            if (state.isActive) {
              store.endSession();
              router.push('/report');
            }
          }, 7000);
          return;
        }

        const question = action.question ?? 'Tell me about yourself.';
        const qId = action.question_id ?? `q_${questionCount + 1}`;
        const qType = action.questionType ?? 'behavioral';
        const isFollowUp = action.isFollowUp === true;
        
        if (!isFollowUp) {
          setQuestionCount((c) => c + 1);
        }

        store.setCurrentQuestion(question, qId, qType, action.testCases, isFollowUp);
        
        // Code playground logic
        if (qType === 'coding') {
          setShowCode(true);
          setCodingSubState(isFollowUp ? 'followup' : 'coding');
        } else if (!isFollowUp) {
          // Hide code window if we move to a new non-coding question
          setShowCode(false);
          setCodingSubState(null);
          store.setCurrentCode('');
        }

        // Use Enhanced TTS
        speak(question, () => store.setIsSpeaking(true), () => store.setIsSpeaking(false));
      } catch (err) {
        console.error('Agent error:', err);
        store.setCurrentQuestion(
          'Tell me about a recent challenge you overcame at work.',
          `fallback_${questionCount + 1}`,
          'behavioral'
        );
      } finally {
        setAgentThinking(false);
      }
    },
    [store, router, questionCount, speak]
  );

  const handleSkipQuestion = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stop(); // Stop any ongoing TTS

    try {
      const turnSummary: TurnSummary = {
        questionId: store.currentQuestionId,
        question: store.currentQuestion,
        questionType: (store.currentQuestionType || 'behavioral') as import('@/types').QuestionCategory,
        answerSummary: '(skipped)',
        fullAnswer: '(skipped)',
        scores: {
          quality: 0,
          sentiment: 'neutral',
          fillerDensity: 0,
          dominantEmotion: 'neutral',
          wpm: 0,
        },
        gaps: [],
        followUpAsked: false,
      };

      ctxManagerRef.current?.addTurn(turnSummary);
      store.addTurn(turnSummary);

      await getNextQuestion('(skipped)', {
        quality: 0,
        sentiment: 'neutral',
        fillerDensity: 0,
      });
    } catch (err) {
      console.error('Skip error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [store, isProcessing, getNextQuestion, stop]);

  const handleSubmitCode = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    isSubmittingRef.current = true;
    stop(); // Stop any TTS

    try {
      // Evaluate the written code in the sandbox context
      const codeInput = store.currentCode;
      const testResults = store.codeTestResults;
      
      const turnSummary: TurnSummary = {
        questionId: store.currentQuestionId,
        question: store.currentQuestion,
        questionType: 'coding',
        answerSummary: `Code sandbox submission: [${store.currentCode ? 'Written Code' : 'Empty Solution'}]. Test cases passed: ${testResults?.passed || 0}/${testResults?.total || 0}`,
        fullAnswer: codeInput,
        scores: {
          // Score calculation: percentage of tests passed scaled to 10
          quality: testResults && testResults.total > 0 
            ? Math.round((testResults.passed / testResults.total) * 10) 
            : 0,
          sentiment: 'neutral',
          fillerDensity: 0, // Coding has no live STT verbal fillers
          dominantEmotion: 'neutral',
          wpm: 0,
        },
        gaps: [],
        followUpAsked: false,
      };

      ctxManagerRef.current?.addTurn(turnSummary);
      store.addTurn(turnSummary);

      // Request follow-up explanation from the agent
      await getNextQuestion(`Code Playground submitted. The candidate's code executed against sample test cases successfully: ${testResults?.passed || 0} passed out of ${testResults?.total || 0} total cases. Candidates code was:\n${codeInput}`, {
        quality: turnSummary.scores.quality,
        sentiment: 'neutral',
        fillerDensity: 0,
      });

    } catch (err) {
      console.error('Code submit error:', err);
    } finally {
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  }, [store, isProcessing, getNextQuestion, stop]);

  const handleSubmitAnswer = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    isSubmittingRef.current = true;
    stop(); // Stop any TTS

    try {
      const audioBlob = await stopRecording();
      let finalTranscript = store.transcript;

      // Double-layered STT processing using Groq Whisper endpoint
      if (audioBlob && audioBlob.size > 100) {
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'audio.webm');

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            if (data.text && data.text.trim().length > 3) {
              finalTranscript = data.text.trim();
              store.setTranscript(finalTranscript);
            }
          }
        } catch (err) {
          console.warn('Groq transcribing fallback to browser STT draft:', err);
        }
      }

      // Check for validation logic (require minimum words for verbal questions)
      const wordCount = finalTranscript.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < 2) {
        setIsProcessing(false);
        isSubmittingRef.current = false;
        return;
      }

      // Live metrics processing
      const fillerResult = detectFillers(finalTranscript);
      const sentimentResult = await fetch('/api/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalTranscript }),
      });
      const sentimentLabel = sentimentResult.ok 
        ? (await sentimentResult.json()).label 
        : 'neutral';

      const qualityResult = await scoreResponse(
        store.currentQuestion,
        finalTranscript,
        store.jobProfile,
        store.currentQuestionType || undefined,
        agentRef.current?.getCurrentExpectedPoints() || [],
        store.codeTestResults
      );

      const turnSummary: TurnSummary = {
        questionId: store.currentQuestionId,
        question: store.currentQuestion,
        questionType: (store.currentQuestionType || 'behavioral') as import('@/types').QuestionCategory,
        answerSummary: finalTranscript.slice(0, 150) + (finalTranscript.length > 150 ? '...' : ''),
        fullAnswer: finalTranscript,
        scores: {
          quality: qualityResult.score,
          sentiment: sentimentLabel,
          fillerDensity: fillerResult.density,
          dominantEmotion: store.currentEmotion?.dominant || 'neutral',
          wpm: store.wordsPerMinute,
          codeTestResults: store.codeTestResults || undefined,
        },
        gaps: [],
        followUpAsked: store.currentQuestionIsFollowUp,
      };

      ctxManagerRef.current?.addTurn(turnSummary);
      store.addTurn(turnSummary);
      
      await getNextQuestion(finalTranscript, {
        quality: qualityResult.score,
        sentiment: sentimentLabel,
        fillerDensity: fillerResult.density,
      });
      
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  }, [store, isProcessing, getNextQuestion, stop, stopRecording]);
  
  return (
    <main className="min-h-screen bg-bg text-fg flex flex-col h-screen overflow-hidden">
      {/* Top Header */}
      <header className="prept-glass h-16 border-b border-border flex items-center justify-between px-6 shrink-0 relative z-50">
        <div className="flex items-center gap-4">
          <PreptWordmark />
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium text-fg-muted tracking-wide">{store.jobProfile}</span>
          <div className="h-4 w-px bg-border" />
          <span className={`prept-label inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full`}>
            <span className={`w-1.5 h-1.5 rounded-full ${store.mode === 'real' ? 'bg-success' : 'bg-accent'}`} />
            <span className={store.mode === 'real' ? 'text-success' : 'text-accent'}>{store.mode} MODE</span>
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <span className="font-grotesk text-sm text-fg-muted tracking-wider">Q.{Math.min(12, store.turns.filter(t => !t.followUpAsked && t.answerSummary !== '(skipped)').length + 1)} / 12</span>
          {voiceSelectorUI}
          <ThemeToggle />
          <button
            onClick={() => { store.endSession(); router.push('/report'); }}
            className="px-4 py-1.5 border border-danger text-danger hover:bg-danger-muted rounded-lg text-sm font-bold transition-colors"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* PANE 1: Left Monitor / Candidate Sidebar (width: 300px) */}
        <div className="w-[300px] shrink-0 bg-surface border-r border-border p-4 flex flex-col gap-4 overflow-y-auto scrollbar-custom z-20">
          {/* Video Player */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-border shadow-md">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform -scale-x-100"
            />
            
            {/* Real-time emotion overlay */}
            <EmotionOverlay videoRef={videoRef} />
            
            {store.currentEmotion && !(store.currentQuestionType === 'coding' && !store.currentQuestionIsFollowUp) && (
              <div className="absolute top-3 left-3 px-2 py-1 prept-glass rounded-lg text-[10px] font-mono font-bold uppercase flex items-center gap-2 text-fg">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                {store.currentEmotion.dominant}
              </div>
            )}
            
            <AnimatePresence>
              {store.isSpeaking && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-3 right-3 px-3 py-1.5 bg-accent/20 backdrop-blur-md border border-accent/30 text-accent rounded-full flex items-center gap-2 text-[10px] font-bold shadow-sm"
                >
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map(i => (
                      <motion.div 
                        key={i} 
                        animate={{ height: ['4px', '10px', '4px'] }} 
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                        className="w-0.5 bg-accent rounded-full" 
                      />
                    ))}
                  </div>
                  AI SPEAKING
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Practice metrics or simpler real-mode panel */}
          {store.mode === 'practice' ? (
            <div className="prept-panel p-4"><ScorePanel /></div>
          ) : (
            <div className="prept-panel p-5 flex flex-col gap-3">
              <h3 className="prept-label">Real Mode Active</h3>
              <div className="flex items-center justify-between text-xs text-fg-muted font-mono">
                <span>Mic Audio Input:</span>
                <span className="text-fg">{Math.max(-60, Math.round(store.loudnessDb))} dB</span>
              </div>
              <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-success rounded-full" 
                  style={{ width: `${Math.max(0, Math.min(100, ((store.loudnessDb + 60) / 60) * 100))}%` }}
                />
              </div>
              <div className="text-[10px] text-fg-muted leading-normal">
                Live performance tracking is running silently. Your response evaluation is generated dynamically by AI behind the scenes.
              </div>
            </div>
          )}
        </div>

        {/* PANE 2: Center Workspace */}
        <div className={`flex flex-col h-full overflow-hidden bg-bg transition-all duration-300 ${
          showCode 
            ? 'w-[420px] shrink-0 border-r border-border' 
            : 'flex-grow min-w-0'
        }`}>
          
          {/* Question Banner */}
          <div className="bg-surface border-b border-border p-6 shrink-0">
            {agentThinking ? (
              <div className="flex items-center gap-3 text-fg-muted">
                <Loader2 className="animate-spin text-accent" size={18} />
                <span className="animate-pulse text-sm font-grotesk">Processing signals & formulating next question...</span>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                <span className="inline-block px-2.5 py-1 mb-3 rounded-lg bg-accent-muted border border-accent/20 text-accent text-[10px] font-bold font-mono uppercase tracking-widest">
                  {store.currentQuestionType} | {store.currentQuestionId}
                </span>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-fg">
                  {store.currentQuestion}
                </h2>
              </motion.div>
            )}
          </div>

          {/* Transcript Display Box */}
          <div className="flex-grow p-6 flex flex-col overflow-hidden min-h-0">
            <TranscriptDisplay />
          </div>

          {/* Bottom Action Bar */}
          <div className="p-4 border-t border-border bg-surface shrink-0 z-10 flex gap-4 items-center">
            {store.mode === 'practice' && (
              <button 
                onClick={handleSkipQuestion} 
                disabled={isProcessing || isEnding}
                className="prept-btn-secondary h-12 px-6 whitespace-nowrap text-sm"
                title="Skip this question"
              >
                Skip
              </button>
            )}
            <button
              onClick={codingSubState === 'coding' ? handleSubmitCode : handleSubmitAnswer}
              disabled={isProcessing || isEnding || (codingSubState !== 'coding' && store.transcriptWordCount < 5)}
              className="w-full prept-btn-primary h-12 justify-center text-sm font-bold uppercase tracking-widest"
            >
              {isProcessing ? (
                codingSubState === 'coding' ? (
                  <><Loader2 size={18} className="animate-spin text-bg" /> Transmitting...</>
                ) : (
                  <><Loader2 size={18} className="animate-spin text-bg" /> Transmitting...</>
                )
              ) : (
                codingSubState === 'coding' ? (
                  <><Check size={18} /> Submit Code</>
                ) : (
                  <><Check size={18} /> Submit Response</>
                )
              )}
            </button>
          </div>
        </div>

        {/* PANE 3: Right Side - Coding Terminal (if coding) OR Side Info Panel (if verbal) */}
        <AnimatePresence mode="wait">
          {showCode ? (
            <motion.div 
              key="coding-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', flex: 1, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="border-l border-border bg-surface flex flex-col h-full z-10"
            >
              <div className="flex items-center gap-2 px-6 py-4 bg-surface-raised border-b border-border">
                <CodeIcon size={16} className="text-accent" />
                <span className="prept-label">Code Playground</span>
              </div>
              <div className="flex-1 p-4 pb-2 relative min-h-0">
                <CodePlayground onSubmitCode={codingSubState === 'coding' ? handleSubmitCode : undefined} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="history-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '360px', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-[360px] shrink-0 bg-surface border-l border-border p-6 overflow-y-auto scrollbar-custom flex flex-col gap-6 z-10"
            >
              {/* Expected guidance points in practice mode */}
              {store.mode === 'practice' && agentRef.current && agentRef.current.getCurrentExpectedPoints().length > 0 && (
                <div className="prept-panel p-5 flex flex-col gap-3">
                  <h3 className="prept-label">Expected Points</h3>
                  <ul className="space-y-3">
                    {agentRef.current.getCurrentExpectedPoints().map((pt, i) => (
                      <li key={i} className="text-sm text-fg flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                        <span className="leading-relaxed">{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Session History turns */}
              <div className="flex flex-col gap-4">
                <h3 className="prept-label">Previous Turns</h3>
                {store.turns.length === 0 ? (
                  <div className="text-xs text-fg-muted italic">No turns completed yet.</div>
                ) : (
                  <div className="space-y-4">
                    {store.turns.slice().reverse().map((turn) => (
                      <div key={turn.questionId} className="prept-panel p-4 text-sm flex flex-col gap-3">
                        <div className="flex justify-between items-center text-[10px] font-mono text-fg-muted uppercase">
                          <span>{turn.questionType}</span>
                          {store.mode === 'practice' && (
                            <span className={`font-bold px-2 py-0.5 rounded-md ${turn.scores.quality >= 7 ? 'bg-success/10 text-success' : turn.scores.quality >= 5 ? 'bg-warn/10 text-warn' : 'bg-danger/10 text-danger'}`}>
                              Score: {turn.scores.quality}/10
                            </span>
                          )}
                        </div>
                        <p className="text-fg font-medium text-sm line-clamp-3 leading-snug">{turn.question}</p>
                        {turn.answerSummary && (
                          <div className="text-xs text-fg-muted border-t border-border-soft pt-3 italic leading-relaxed">
                            Summary: {turn.answerSummary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
      
      {/* Hidden Audio Analyzer for metrics */}
      <AudioAnalyzer />
    </main>
  );
}
