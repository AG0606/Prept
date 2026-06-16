// ════════════════════════════════════════════════════════════
// Token Counter & Budget Manager
// Keeps Gemini API calls small, fast, and within free tier
// ════════════════════════════════════════════════════════════

/** Approximation: 1 token ≈ 4 chars for English text */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Token budgets per section of the Gemini prompt */
export const TOKEN_BUDGETS = {
  SYSTEM_PROMPT: 800,
  RESUME_CONTEXT: 800,      // Increased to allow better context
  CONVERSATION_HISTORY: 1500, // Increased to maintain coherence
  CURRENT_ANSWER: 800,      // Increased to support longer coding answers
  LIVE_SIGNALS: 250,
  TOTAL_BUDGET: 4500,       // Increased safely within 1M token context limit
} as const;

/**
 * Trim text to fit within a token budget.
 * Keeps the most recent content (trims from the start).
 */
export function trimToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return '...[trimmed]...' + text.slice(text.length - maxChars + 15);
}
