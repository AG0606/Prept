import type { FillerResult } from '@/types';

// More precise patterns that avoid false positives
const FILLER_PATTERNS = [
  /\b(um+|uh+|uhh+|umm+)\b/gi,
  /\b(you know)\b/gi,
  /\b(basically|literally|honestly)\b/gi,
  /\b(sort of|kind of|i guess)\b/gi,
  /\b(and uh|or uh)\b/gi,
];

// Context-aware "like" detection: only match filler "like"
// Exclude: "I like", "looks like", "something like", "like a", "like the", etc.
const FILLER_LIKE = /(?<!(i|we|they|looks|look|looked|something|anything|nothing|feel|felt|seems?|sounds?)\s+)\blike\b(?!\s+(a|an|the|to|that|it|this|how|when|where|what|which|i|we|they|more|less))/gi;

/**
 * Detect filler words in a transcript string.
 * Returns count, matched words, and density per 100 words.
 */
export function detectFillers(transcript: string): FillerResult {
  if (!transcript || transcript.trim().length === 0) {
    return { count: 0, words: [], density: 0 };
  }
  
  const words = transcript.split(/\s+/).filter(Boolean);
  const found: string[] = [];

  for (const pattern of FILLER_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = transcript.match(pattern) ?? [];
    found.push(...matches);
  }
  
  // Check for filler "like" separately with context
  FILLER_LIKE.lastIndex = 0;
  const likeMatches = transcript.match(FILLER_LIKE) ?? [];
  found.push(...likeMatches);

  return {
    count: found.length,
    words: found,
    density: words.length > 0 ? (found.length / words.length) * 100 : 0,
  };
}

/** Human-readable feedback based on filler density */
export function getFillerFeedback(density: number): string {
  if (density < 2) return 'Excellent — very clean speech';
  if (density < 5) return 'Good — minor filler usage';
  if (density < 10) return 'Moderate — work on reducing fillers';
  return 'High filler density — practice deliberate pausing instead';
}
