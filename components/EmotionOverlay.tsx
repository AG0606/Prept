'use client';
// ════════════════════════════════════════════════════════════
// Emotion Overlay — face-api.js Real-Time Detection
// ════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';
import { loadEmotionModels, detectEmotion } from '@/lib/models/emotionModel';
import { useInterviewStore } from '@/store/interviewStore';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function EmotionOverlay({ videoRef }: Props) {
  const intervalRef = useRef<number>();
  const setEmotion = useInterviewStore((s) => s.setEmotion);
  const isActive = useInterviewStore((s) => s.isActive);

  const startDetection = useCallback(() => {
    let lastDetection = 0;
    const loop = async (time: number) => {
      if (time - lastDetection > 500) {
        const state = useInterviewStore.getState();
        const isCodingState = state.currentQuestionType === 'coding' && !state.currentQuestionIsFollowUp;

        if (videoRef.current && !isCodingState) {
          const reading = await detectEmotion(videoRef.current);
          if (reading) {
            setEmotion(reading);
          }
        }
        lastDetection = time;
      }
      intervalRef.current = requestAnimationFrame(loop);
    };
    intervalRef.current = requestAnimationFrame(loop);
  }, [videoRef, setEmotion]);

  useEffect(() => {
    if (!isActive) return;

    let mounted = true;
    async function init() {
      try {
        await loadEmotionModels();
        if (mounted) startDetection();
      } catch (err) {
        console.error('Failed to load emotion models:', err);
      }
    }
    init();

    return () => {
      mounted = false;
      if (intervalRef.current) cancelAnimationFrame(intervalRef.current);
    };
  }, [isActive, startDetection]);

  return null; // HUD rendered by parent component
}
