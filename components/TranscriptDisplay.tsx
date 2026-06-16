'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useInterviewStore } from '@/store/interviewStore';
import { Mic, MicOff } from 'lucide-react';

type SpeechRecognitionType = any;

export function TranscriptDisplay() {
  const transcript = useInterviewStore((s) => s.transcript);
  const isListening = useInterviewStore((s) => s.isListening);
  const isActive = useInterviewStore((s) => s.isActive);
  const currentQuestionId = useInterviewStore((s) => s.currentQuestionId);
  const setTranscript = useInterviewStore((s) => s.setTranscript);
  const setIsListening = useInterviewStore((s) => s.setIsListening);
  const recognitionRef = useRef<SpeechRecognitionType>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const interimRef = useRef('');
  const committedRef = useRef('');

  useEffect(() => {
    committedRef.current = '';
    interimRef.current = '';
  }, [currentQuestionId]);

  const startRecognition = useCallback(() => {
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let sessionFinal = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          sessionFinal += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      const full = (committedRef.current + sessionFinal).trim();
      if (full) {
        setTranscript(full);
      }
      interimRef.current = interim;
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      committedRef.current = useInterviewStore.getState().transcript + ' ';
      if (isActive && isListening) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isActive, isListening, setTranscript, setIsListening]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [setIsListening]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex flex-col saas-card h-full">
      <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-surface-warm">
        <h3 className="text-xs font-mono font-bold text-fg-muted uppercase tracking-widest flex items-center gap-2">
          Live Transcript
        </h3>
        <div>
          {isListening ? (
            <button
              onClick={stopRecognition}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-all duration-150"
            >
              <div className="relative flex items-center justify-center w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
              </div>
              Stop Listening
            </button>
          ) : (
            <button
              onClick={startRecognition}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider bg-surface text-fg-muted border border-border hover:bg-surface-warm hover:text-fg transition-all duration-150 shadow-sm"
            >
              <Mic size={14} /> Start Speaking
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto scrollbar-custom bg-surface" ref={scrollRef}>
        {transcript || interimRef.current ? (
          <p className="text-base leading-relaxed text-fg">
            {transcript}
            {interimRef.current && (
              <span className="text-fg-muted italic">
                {' '}
                {interimRef.current}
              </span>
            )}
          </p>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-fg-muted">
            <MicOff size={32} className="mb-4 opacity-30 text-fg-muted" />
            <p className="text-sm font-medium tracking-wide">
              {isListening
                ? 'Speak your answer clearly...'
                : 'Microphone is off. Click "Start Speaking" to begin.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
