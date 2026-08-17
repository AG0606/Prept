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
    jobDescription: useInterviewStore(s => s.jobDescription),
    interviewerPersona: useInterviewStore(s => s.interviewerPersona),
    gapAnalysis: useInterviewStore(s => s.gapAnalysis),
    loudnessDb: useInterviewStore(s => s.loudnessDb),
    vadEnabled: useInterviewStore(s => s.vadEnabled),
    setVadEnabled: useInterviewStore(s => s.setVadEnabled),
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [agentThinking, setAgentThinking] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [vadCountdown, setVadCountdown] = useState<number | null>(null);
  
  const [sessionStarted, setSessionStarted] = useState(false);
  const { speak, stop, voiceSelectorUI, ttsWarning } = useEnhancedTTS();
  const { startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const isSubmittingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!store.resumeData || !store.jobProfile) {
      router.push('/');
      return;
    }

    const ctxManager = new ContextManager(store.resumeData, store.jobProfile, {
      jobDescription: store.jobDescription || undefined,
      interviewerPersona: store.interviewerPersona || 'standard',
      gapAnalysis: store.gapAnalysis || undefined,
    });
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

    let videoElementStream: MediaStream | null = null;
    if (navigator?.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
        .then((stream) => {
          videoElementStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(e => console.warn('Video playback notice:', e));
            };
            setCameraActive(true);
          }
        })
        .catch((err) => {
          console.warn('Camera access not granted:', err);
          setCameraError('Camera disabled (Audio telemetry running)');
        });
    }

    return () => {
      if (videoElementStream) {
        videoElementStream.getTracks().forEach((t) => t.stop());
      }
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartSession = useCallback(() => {
    setSessionStarted(true);
    hasStartedRef.current = true;
    getNextQuestion();
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
          () => {
            store.setIsSpeaking(false);
            store.endSession();
            router.push('/report');
          }
        );
        setTimeout(() => {
          store.endSession();
          router.push('/report');
        }, 4000);
        return;
      }

      setQuestionCount(prev => prev + 1);
      const isFollowUp = action.isFollowUp || false;
      const question = action.question || 'Can you expand on your technical background?';
      const qId = action.question_id || `turn_${questionCount + 1}`;
      const qType = action.questionType || 'behavioral';

      store.setCurrentQuestion(question, qId, qType, undefined, isFollowUp);
      speak(question, () => store.setIsSpeaking(true), () => store.setIsSpeaking(false));
    } catch (err) {
      console.error('Submit answer error:', err);
    } finally {
      setIsProcessing(false);
      isSubmittingRef.current = false;
    }
  }, [store, isProcessing, router, questionCount, speak, stop]);

  // VAD (Voice Activity Detection) Auto-Submit on natural silence pause
  useEffect(() => {
    if (!store.vadEnabled || !store.isListening || isProcessing || isSubmittingRef.current) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setVadCountdown(null);
      return;
    }

    const wordCount = store.transcriptWordCount || 0;
    const isQuiet = store.loudnessDb < -46;

    // Only activate auto-submit if candidate has spoken at least 6 words
    if (wordCount >= 6 && isQuiet) {
      if (!silenceTimerRef.current && vadCountdown === null) {
        silenceTimerRef.current = setTimeout(() => {
          let remaining = 2;
          setVadCountdown(remaining);
          countdownIntervalRef.current = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              setVadCountdown(null);
              handleSubmitAnswer();
            } else {
              setVadCountdown(remaining);
            }
          }, 1000);
        }, 1800);
      }
    } else if (store.loudnessDb >= -42) {
      // Candidate resumed speaking — cancel countdown
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (vadCountdown !== null) {
        setVadCountdown(null);
      }
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [store.vadEnabled, store.isListening, store.loudnessDb, store.transcriptWordCount, isProcessing, vadCountdown, handleSubmitAnswer]);

  return (
    <div className="flex flex-col h-screen bg-bg text-fg select-none overflow-hidden font-grotesk">
      {/* Top HUD Bar */}
      <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-6">
          <PreptWordmark />
          <div className="h-4 w-[1px] bg-border" />
          <span className="text-xs font-mono text-fg-muted font-bold">
            {store.mode === 'real' ? 'REAL INTERVIEW HUD' : 'PRACTICE SANDBOX'}
          </span>
          {store.interviewerPersona && store.interviewerPersona !== 'standard' && (
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono uppercase bg-accent-muted text-accent border border-accent/20">
              {store.interviewerPersona} style
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* VAD Toggle */}
          <button
            onClick={() => store.setVadEnabled(!store.vadEnabled)}
            className={`px-3 py-1 text-xs font-mono border transition-colors flex items-center gap-2 ${
              store.vadEnabled
                ? 'bg-accent-muted text-accent border-accent/30'
                : 'bg-surface text-fg-muted border-border hover:text-fg'
            }`}
            title="Voice Activity Detection (Auto-submits on natural speech pause)"
          >
            <span className={`w-2 h-2 rounded-full ${store.vadEnabled ? 'bg-accent animate-pulse' : 'bg-fg-muted'}`} />
            VAD Auto-Listen: {store.vadEnabled ? 'ON' : 'OFF'}
          </button>

          {voiceSelectorUI}
          
          <button 
            onClick={() => {
              store.endSession();
              router.push('/dashboard');
            }}
            className="text-xs text-danger hover:underline font-mono"
          >
            Abort
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-grow min-h-0 overflow-hidden relative">
        {/* Pre-Flight Calibration Room Overlay */}
        {!sessionStarted && (
          <div className="absolute inset-0 bg-bg/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="prept-card p-8 max-w-lg w-full border-2 border-border shadow-2xl space-y-6"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="prept-label">Pre-Flight Calibration</span>
                  <span className="px-2 py-0.5 bg-accent-muted text-accent text-[10px] font-mono font-bold uppercase">
                    Ready
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-fg">
                  Ready to Enter Interview Room
                </h2>
                <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                  Candidate: <strong className="text-fg">{store.resumeData?.name || 'Engineer'}</strong> | Role: <strong className="text-fg">{store.jobProfile}</strong>
                </p>
              </div>

              <div className="p-4 bg-surface border border-border-soft space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between text-fg">
                  <span className="text-fg-muted">Interviewer Persona:</span>
                  <span className="font-bold uppercase text-accent">{store.interviewerPersona || 'Standard'}</span>
                </div>
                <div className="flex items-center justify-between text-fg">
                  <span className="text-fg-muted">Primary Voice Engine:</span>
                  <span className="font-bold text-success">Ava (Natural Neural)</span>
                </div>
                <div className="flex items-center justify-between text-fg">
                  <span className="text-fg-muted">Simulation Mode:</span>
                  <span className="font-bold uppercase">{store.mode === 'real' ? 'Real Assessment' : 'Practice Sandbox'}</span>
                </div>
                <div className="flex items-center justify-between text-fg">
                  <span className="text-fg-muted">VAD Auto-Listen:</span>
                  <span className="font-bold text-accent">{store.vadEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <button
                onClick={handleStartSession}
                className="prept-btn-gradient w-full h-14 justify-center text-sm font-bold uppercase tracking-wider"
              >
                Enter Interview Room & Begin
              </button>
            </motion.div>
          </div>
        )}

        {/* PANE 1: Left Live Telemetry Column */}
        <div className="w-[320px] shrink-0 bg-surface border-r border-border p-6 overflow-y-auto scrollbar-custom flex flex-col gap-6 z-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="prept-label">Webcam Monitor</h3>
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-fg-muted">
                <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-success animate-pulse' : cameraError ? 'bg-danger' : 'bg-warn'}`} />
                {cameraActive ? 'LIVE' : cameraError ? 'DISABLED' : 'INIT'}
              </span>
            </div>
            <div className="relative aspect-video bg-surface-warm border border-border overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <EmotionOverlay videoRef={videoRef} />
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-bg/80 border border-border text-[9px] font-mono text-fg-muted">
                CAM_01 // 30FPS
              </div>
              {!cameraActive && (
                <div className="absolute inset-0 bg-surface flex flex-col items-center justify-center p-4 text-center">
                  <span className="text-xs font-mono text-fg-muted">
                    {cameraError || 'Connecting Camera...'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {store.mode === 'practice' ? (
            <ScorePanel />
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
          {/* TTS Fallback Warning Banner */}
          {ttsWarning && (
            <div className="bg-warn/10 border-b border-warn/30 px-6 py-2 text-xs font-mono text-warn flex items-center justify-between shrink-0">
              <span className="flex items-center gap-2">
                <span>⚠️</span> {ttsWarning}
              </span>
            </div>
          )}
          
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
            {/* VAD Countdown Indicator */}
            {vadCountdown !== null && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-3 py-1.5 bg-accent text-accent-on text-xs font-mono font-bold flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                Silence detected. Auto-submitting in {vadCountdown}s...
              </motion.div>
            )}

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
    </div>
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
