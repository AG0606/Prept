// ════════════════════════════════════════════════════════════
// Quality Scorer — ONNX / HuggingFace Fallback
// ════════════════════════════════════════════════════════════

import type { QualityScore, CodeTestResults } from '@/types';

export async function scoreResponse(
  question: string,
  answer: string,
  jobRole: string,
  questionType?: string,
  expectedPoints?: string[],
  testResults?: CodeTestResults | null
): Promise<QualityScore> {
  try {
    const response = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer, jobRole, questionType, expectedPoints, testResults }),
    });
    if (!response.ok) throw new Error(`Score API error: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Quality scoring error:', error);
    return {
      score: 5,
      starScore: 2,
      completeness: 0.5,
      relevance: 0.5,
      feedback: 'Unable to score — using default values',
    };
  }
}
