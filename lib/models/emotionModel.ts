// ════════════════════════════════════════════════════════════
// Emotion Model — face-api.js Wrapper
// Loads TinyFaceDetector + FaceExpressionNet for browser ML
// ════════════════════════════════════════════════════════════

import type { EmotionReading } from '@/types';

let modelsLoaded = false;
let faceapi: typeof import('face-api.js') | null = null;

/**
 * Dynamically load face-api.js and model weights.
 * Models are served from /public/models/
 */
export async function loadEmotionModels(): Promise<void> {
  if (modelsLoaded) return;

  faceapi = await import('face-api.js');
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models'),
  ]);

  modelsLoaded = true;
}

/**
 * Detect emotions from a video element.
 * Returns the dominant emotion and all expression scores.
 */
export async function detectEmotion(
  videoElement: HTMLVideoElement
): Promise<EmotionReading | null> {
  if (!faceapi || !modelsLoaded) return null;

  // Verify video element is ready for detection
  if (
    !videoElement ||
    videoElement.paused ||
    videoElement.ended ||
    videoElement.readyState < 2 ||
    videoElement.videoWidth === 0
  ) {
    return null;
  }

  try {
    const result = await faceapi
      .detectSingleFace(
        videoElement,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.15 })
      )
      .withFaceExpressions();

    if (!result?.expressions) return null;

    const scores = result.expressions as unknown as Record<string, number>;
    const dominant = Object.entries(scores).sort(
      ([, a], [, b]) => b - a
    )[0][0];

    return { dominant, scores, timestamp: Date.now() };
  } catch (err) {
    console.warn('detectEmotion error:', err);
    return null;
  }
}

export function isModelsLoaded(): boolean {
  return modelsLoaded;
}
