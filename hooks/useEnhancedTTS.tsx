'use client';

import { useState, useCallback, useRef } from 'react';
import { Volume2, AlertCircle } from 'lucide-react';

const EDGE_TTS_VOICES = [
  { id: 'en-US-AvaMultilingualNeural', name: 'Ava (Natural Female)' },
  { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew (Natural Male)' },
  { id: 'en-US-EmmaMultilingualNeural', name: 'Emma (Natural Female)' },
  { id: 'en-US-BrianMultilingualNeural', name: 'Brian (Natural Male)' },
];

export function useEnhancedTTS() {
  const [selectedVoice, setSelectedVoice] = useState<string>('en-US-AvaMultilingualNeural');
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<number>(0);

  const stop = useCallback(() => {
    // Increment call ID to immediately invalidate any pending fetch or play operations
    callIdRef.current++;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const fallbackSpeak = useCallback((text: string, onStart?: () => void, onEnd?: () => void) => {
    setTtsWarning('Primary neural voice service unreachable. Using local speech synthesis (audio fidelity may vary).');
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    // Try to find a nice English voice if available locally
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft') || v.name.includes('Samantha')));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    utterance.rate = 1.05;
    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text: string, onStart?: () => void, onEnd?: () => void) => {
    // 1. Invalidate previous calls
    stop();
    const myCallId = ++callIdRef.current;

    try {
      // 2. Fetch Edge TTS audio
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: selectedVoice })
      });

      // If another call came in while fetching, abort silently
      if (myCallId !== callIdRef.current) return;

      if (!response.ok) {
        throw new Error(`Edge TTS failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      if (myCallId !== callIdRef.current) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        // If a new question or stop happened during play setup, stop immediately
        if (myCallId !== callIdRef.current) {
          audio.pause();
          return;
        }
        setTtsWarning(null);
        onStart?.();
      };

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (myCallId === callIdRef.current) {
          onEnd?.();
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (myCallId === callIdRef.current) {
          fallbackSpeak(text, onStart, onEnd);
        }
      };

      await audio.play();
    } catch (e) {
      console.warn('Primary TTS failed, using fallback voice:', e);
      if (myCallId === callIdRef.current) {
        fallbackSpeak(text, onStart, onEnd);
      }
    }
  }, [selectedVoice, stop, fallbackSpeak]);

  const voiceSelectorUI = (
    <div className="flex items-center gap-2 bg-surface px-2.5 py-1 border border-border">
      <Volume2 size={15} className="text-accent shrink-0" />
      <select 
        value={selectedVoice} 
        onChange={(e) => setSelectedVoice(e.target.value)}
        className="bg-surface text-xs font-mono font-bold text-fg outline-none border-none cursor-pointer max-w-[170px] truncate"
        title="Select AI Interviewer Voice"
      >
        {EDGE_TTS_VOICES.map(v => (
          <option key={v.id} value={v.id} className="bg-surface text-fg font-mono text-xs">
            {v.name}
          </option>
        ))}
      </select>
    </div>
  );

  return { speak, stop, voiceSelectorUI, ttsWarning };
}

