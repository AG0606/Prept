'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useInterviewStore } from '@/store/interviewStore';
import { ContextManager } from '@/lib/contextManager';
import { GeminiAgent } from '@/lib/geminiAgent';
import { detectFillers } from '@/lib/fillerDetector';
import { EmotionOverlay } from '@/components/EmotionOverlay';
import { AudioAnalyzer } from '@/components/AudioAnalyzer';
import { TranscriptDisplay } from '@/components/TranscriptDisplay';
import { ScorePanel } from '@/components/ScorePanel';
import { PreptWordmark } from '@/components/PreptLogo';
import type { TurnSummary, LiveSignals } from '@/types';
import { Check, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEnhancedTTS } from '@/hooks/useEnhancedTTS';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

export default function InterviewPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ctxManagerRef = useRef<ContextManager | null>(null);
  const agentRef = useRef<GeminiAgent | null>(null);
  const hasStartedRef = useRef(false);

  const store = {
    resumeData: useInterviewStore(s => s.resumeData),
    jobProfile: useInterviewStore(s => s.jobProfile),
    mode: useInterviewStore(s => s.mode),
    techSplit: useInterviewStore(s => s.techSplit),
    hrSplit: useInterviewStore(s => s.hrSplit),
    codeSplit: useInterviewStore(s => s.codeSplit),
    isListening: useInterviewStore(s => s.isListening),
    currentEmotion: useInterviewStore(s => s.currentEmotion),
    currentQuestionId: useInterviewStore(s => s.currentQuestionId),
    currentQuestion: useInterviewStore(s => s.currentQuestion),
    currentQuestionType: useInterviewStore(s => s.currentQuestionType),
    currentQuestionIsFollowUp: useInterviewStore(s => s.currentQuestionIsFollowUp),
    transcriptWordCount: useInterviewStore(s => s.transcriptWordCount),
    turns: useInterviewStore(s => s.turns),
    isSpeaking: useInterviewStore(s => s.isSpeaking),
    setCurrentQuestion: useInterviewStore(s => s.setCurrentQuestion),
    setIsSpeaking: useInterviewStore(s => s.setIsSpeaking),
    endSession: useInterviewStore(s => s.endSession),
    addTurn: useInterviewStore(s => s.addTurn),
    setTranscript: useInterviewStore(s => s.setTranscript),
    setCurrentCode: useInterviewStore(s => s.setCurrentCode),
    setIsListening: useInterviewStore(s => s.setIsListening),
    setQualityScore: useInterviewStore(s => s.setQualityScore),
    setSentiment: useInterviewStore(s => s.setSentiment),
    setFillerCount: useInterviewStore(s => s.setFillerCount),
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [agentThinking, setAgentThinking] = useState(false);
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
    const agent = new GeminiAgent(ctxManager, {
      mode: store.mode,
      techSplit: store.techSplit,
      hrSplit: store.hrSplit,
      codeSplit: store.codeSplit
    });
    agentRef.current = agent;

    // Load or generate cached resume-specific questions for this resume + role
    if (store.resumeData?.id) {
      const resumeId = store.resumeData.id;
      const jobProfile = store.jobProfile;
      fetch(`/api/resume-questions?resumeId=${resumeId}&jobProfile=${encodeURIComponent(jobProfile)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.questions && data.questions.length > 0) {
            agent.setCachedQuestions(data.questions);
          } else {
            // Background pre-generate questions so they are cached for future runs & later turns
            fetch('/api/resume-questions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resumeId,
                jobProfile,
                resumeData: store.resumeData,
              })
            }).then(r => r.ok ? r.json() : null)
              .then(genData => {
                if (genData?.questions) {
                  agent.setCachedQuestions(genData.questions);
                }
              }).catch(() => {});
          }
        })
        .catch(err => console.warn('Failed to load cached resume questions:', err));
    }

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
      startRecording().catch(err => {
        alert("Microphone access denied or error occurred. Please check permissions.");
        store.setIsListening(false);
      });
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
        wpm: useInterviewStore.getState().wordsPerMinute,
        loudnessDb: useInterviewStore.getState().loudnessDb,
        fillerDensity: useInterviewStore.getState().fillerDensity,
        codeContent: useInterviewStore.getState().currentCode || undefined,
        codeTestResults: useInterviewStore.getState().codeTestResults || undefined,
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

        store.setCurrentQuestion(question, qId, qType, undefined, isFollowUp);

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

  const handleSubmitAnswer = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    isSubmittingRef.current = true;
    stop(); // Stop any TTS

    try {
      const audioBlob = await stopRecording();
      let finalTranscript = useInterviewStore.getState().transcript;

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
      if (wordCount < 5) {
        alert("Your answer is too short to evaluate. Please speak or type a more detailed response before submitting.");
        store.setIsListening(false);
        setIsProcessing(false);
        isSubmittingRef.current = false;
        return;
      }

      // Local filler detection (no API call needed)
      const fillerResult = detectFillers(finalTranscript);

      const agent = agentRef.current;
      if (!agent) throw new Error('Agent not initialized');

      // Check if we should end session before making API call
      if (agent.shouldEndSession()) {
        const endAction = agent.processUnifiedResponse({ type: 'end_session', reason: 'All planned questions completed' });
        store.endSession();
        router.push('/report');
        return;
      }

      // Get prompt + context with conditional resume injection
      const liveSignals: LiveSignals = {
        dominantEmotion: store.currentEmotion?.dominant || 'neutral',
        wpm: useInterviewStore.getState().wordsPerMinute,
        loudnessDb: useInterviewStore.getState().loudnessDb,
        fillerDensity: fillerResult.density,
      };

      const { systemPrompt, context } = agent.getPromptAndContext(liveSignals);

      const unifiedRes = await fetch('/api/agent-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemPrompt,
          context,
          lastAnswer: finalTranscript.slice(0, 800),
          question: store.currentQuestion,
          questionType: store.currentQuestionType || 'behavioral',
          jobRole: store.jobProfile,
          expectedPoints: agent.getCurrentExpectedPoints(),
        }),
      });

      if (!unifiedRes.ok) {
        throw new Error(`Agent-turn API error: ${unifiedRes.statusText}`);
      }

      const unifiedData = await unifiedRes.json();
      const { evaluation, nextAction } = unifiedData;

      // Update live telemetry panel
      store.setQualityScore(evaluation.score);
      store.setSentiment(evaluation.sentiment);
      store.setFillerCount(fillerResult.count, fillerResult.density);

      // Build turn summary
      const turnSummary: TurnSummary = {
        questionId: store.currentQuestionId,
        question: store.currentQuestion,
        questionType: (store.currentQuestionType || 'behavioral') as import('@/types').QuestionCategory,
        answerSummary: finalTranscript.slice(0, 150) + (finalTranscript.length > 150 ? '...' : ''),
        fullAnswer: finalTranscript,
        scores: {
          quality: evaluation.score,
          sentiment: evaluation.sentiment,
          fillerDensity: fillerResult.density,
          dominantEmotion: store.currentEmotion?.dominant || 'neutral',
          wpm: useInterviewStore.getState().wordsPerMinute,
        },
        gaps: [],
        followUpAsked: store.currentQuestionIsFollowUp,
      };

      ctxManagerRef.current?.addTurn(turnSummary);
      store.addTurn(turnSummary);

      // Process the next action through agent-side logic (type enforcement, follow-up tracking)
      const action = agent.processUnifiedResponse(nextAction);

      if (action.type === 'end_session') {
        setIsEnding(true);
        speak(action.finalImpression || 'Thank you for completing this interview. Great job!',
          () => store.setIsSpeaking(true),
          () => store.setIsSpeaking(false)
        );
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

      store.setCurrentQuestion(question, qId, qType, undefined, isFollowUp);

      // Use Enhanced TTS (fires in parallel with UI updates)
      speak(question, () => store.setIsSpeaking(true), () => store.setIsSpeaking(false));

    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  }, [store, isProcessing, questionCount, stop, stopRecording, speak, router]);
  
  return (
    <main className="min-h-screen bg-bg text-fg flex flex-col h-screen overflow-hidden">
      {/* Top Header */}
      <header className="prept-glass h-16 border-b border-border flex items-center justify-between px-6 shrink-0 relative z-50">
        <div className="flex items-center gap-4">
          <PreptWordmark />
          <div className="h-4 w-px bg-border" />
          <span className="font-mono text-xs text-fg-muted uppercase tracking-widest flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${store.mode === 'real' ? 'bg-success' : 'bg-accent'}`} />
            <span className={store.mode === 'real' ? 'text-success' : 'text-accent'}>{store.mode} MODE</span>
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <span className="font-grotesk text-sm text-fg-muted tracking-wider">Q.{Math.min(12, store.turns.filter(t => !t.followUpAsked && t.answerSummary !== '(skipped)').length + 1)} / 12</span>
          {voiceSelectorUI}
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
            
            {store.currentEmotion && (
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
              <RealModeMicMonitor />
              <div className="text-[10px] text-fg-muted leading-normal">
                Live performance tracking is running silently. Your response evaluation is generated dynamically by AI behind the scenes.
              </div>
            </div>
          )}
        </div>

        {/* PANE 2: Center Workspace */}
        <div className="flex-grow min-w-0 flex flex-col h-full overflow-hidden bg-bg">
          
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
              onClick={handleSubmitAnswer}
              disabled={isProcessing || isEnding || store.transcriptWordCount < 5}
              className="w-full prept-btn-primary h-12 justify-center text-sm font-bold uppercase tracking-widest"
            >
              {isProcessing ? (
                <><Loader2 size={18} className="animate-spin text-bg" /> Transmitting...</>
              ) : (
                <><Check size={18} /> Submit Response</>
              )}
            </button>
          </div>
        </div>

        {/* PANE 3: Right Side - Side Info & Previous Turns Panel */}
        <div className="w-[360px] shrink-0 bg-surface border-l border-border p-6 overflow-y-auto scrollbar-custom flex flex-col gap-6 z-10">
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
        </div>

      </div>
      
      {/* Hidden Audio Analyzer for metrics */}
      <AudioAnalyzer />
    </main>
  );
}

function RealModeMicMonitor() {
  const loudnessDb = useInterviewStore(s => s.loudnessDb);
  return (
    <>
      <div className="flex items-center justify-between text-xs text-fg-muted font-mono">
        <span>Mic Audio Input:</span>
        <span className="text-fg">{Math.max(-60, Math.round(loudnessDb))} dB</span>
      </div>
      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <div 
          className="h-full bg-success rounded-full" 
          style={{ width: `${Math.max(0, Math.min(100, ((loudnessDb + 60) / 60) * 100))}%` }}
        />
      </div>
    </>
  );
}
