'use client';
// ════════════════════════════════════════════════════════════
// Audio Analyzer — Web Audio API Loudness + WPM Tracking
// ════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useInterviewStore } from '@/store/interviewStore';

export function AudioAnalyzer() {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const setAudioMetrics = useInterviewStore((s) => s.setAudioMetrics);
  const transcriptWordCount = useInterviewStore((s) => s.transcriptWordCount);
  const isActive = useInterviewStore((s) => s.isActive);
  const speechStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) return;

    async function setup() {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(streamRef.current);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        tick();
      } catch (err) {
        console.error('Audio setup failed:', err);
      }
    }

    let lastUpdate = 0;

    function tick() {
      const analyser = analyserRef.current;
      if (!analyser) return;

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      const now = Date.now();
      if (now - lastUpdate > 500) { // Update every 500ms for stability
        const state = useInterviewStore.getState();
        const isListening = state.isListening;
        const isSpeaking = state.isSpeaking;
        const currentQuestionType = state.currentQuestionType;
        const currentQuestionIsFollowUp = state.currentQuestionIsFollowUp;

        const isSpeechActive = isListening && !isSpeaking && !(currentQuestionType === 'coding' && !currentQuestionIsFollowUp);

        if (!isSpeechActive) {
          speechStartTimeRef.current = null;
          setAudioMetrics(-60, 0);
          lastUpdate = now;
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const loudnessDb = 20 * Math.log10(avg / 255 + 0.0001);
        
        let wpm = 0;
        if (transcriptWordCount === 0) {
          speechStartTimeRef.current = null;
        } else {
          if (speechStartTimeRef.current === null) {
            speechStartTimeRef.current = now;
          }
          const elapsedSec = (now - speechStartTimeRef.current) / 1000;
          if (elapsedSec < 4) {
            wpm = 130; // Default to optimal pace (130 WPM) during first 4 seconds of speech to prevent flickering
          } else {
            wpm = Math.round(transcriptWordCount / (elapsedSec / 60));
          }
        }

        setAudioMetrics(loudnessDb, wpm);
        lastUpdate = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    setup();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [isActive, setAudioMetrics, transcriptWordCount]);

  return null;
}
