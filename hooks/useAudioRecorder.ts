'use client';

import { useState, useRef, useCallback } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Let browser decide standard default
        }
      } else {
        mimeType = '';
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Get audio slices every 250ms
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start audio recording:', err);
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      const stream = streamRef.current;

      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        // Release the microphone resource
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        mediaRecorderRef.current = null;
        streamRef.current = null;
        chunksRef.current = [];
        setIsRecording(false);

        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    const stream = streamRef.current;

    if (recorder) {
      recorder.onstop = null; // Bypass the standard stop resolver
      try {
        recorder.stop();
      } catch {}
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording,
  };
}
