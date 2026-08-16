// ════════════════════════════════════════════════════════════
// Load Balancer — Dynamic Groq / Gemini Routing
// Tracks per-session call counts and routes based on budget
// ════════════════════════════════════════════════════════════

interface CallRecord {
  timestamp: number;
  provider: 'groq' | 'gemini';
}

// Free tier limits (conservative estimates)
const LIMITS = {
  groq: { rpmMax: 28, rpdMax: 900 },     // Leave buffer under 30 RPM / 1000 RPD
  gemini: { rpmMax: 13, rpdMax: 1400 },   // Leave buffer under 15 RPM / 1500 RPD
};

class LoadBalancer {
  private calls: CallRecord[] = [];
  private sessionStart: number = Date.now();

  /** Record a successful API call */
  recordCall(provider: 'groq' | 'gemini') {
    this.calls.push({ timestamp: Date.now(), provider });
  }

  /** Get calls in the last N milliseconds for a provider */
  private getRecentCalls(provider: 'groq' | 'gemini', windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    return this.calls.filter(c => c.provider === provider && c.timestamp > cutoff).length;
  }

  /** Get total calls today for a provider */
  private getDailyCalls(provider: 'groq' | 'gemini'): number {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.calls.filter(c => c.provider === provider && c.timestamp > todayStart.getTime()).length;
  }

  /**
   * Choose the best provider for a given task priority.
   * 'speed' → prefer Groq (faster)
   * 'quality' → prefer Gemini (better for complex tasks)
   */
  getProvider(priority: 'speed' | 'quality' = 'speed'): 'groq' | 'gemini' {
    const groqRPM = this.getRecentCalls('groq', 60000);
    const geminiRPM = this.getRecentCalls('gemini', 60000);
    const groqRPD = this.getDailyCalls('groq');
    const geminiRPD = this.getDailyCalls('gemini');

    const groqAvailable = groqRPM < LIMITS.groq.rpmMax && groqRPD < LIMITS.groq.rpdMax;
    const geminiAvailable = geminiRPM < LIMITS.gemini.rpmMax && geminiRPD < LIMITS.gemini.rpdMax;

    if (!groqAvailable && !geminiAvailable) {
      // Both saturated — return the one with more RPM headroom
      return groqRPM < geminiRPM ? 'groq' : 'gemini';
    }

    if (priority === 'quality') {
      return geminiAvailable ? 'gemini' : 'groq';
    }

    // Speed priority: prefer Groq
    return groqAvailable ? 'groq' : 'gemini';
  }

  /** Get usage stats for debugging/monitoring */
  getStats() {
    return {
      groq: {
        rpm: this.getRecentCalls('groq', 60000),
        rpd: this.getDailyCalls('groq'),
        limits: LIMITS.groq,
      },
      gemini: {
        rpm: this.getRecentCalls('gemini', 60000),
        rpd: this.getDailyCalls('gemini'),
        limits: LIMITS.gemini,
      },
      totalCalls: this.calls.length,
      sessionDuration: Math.round((Date.now() - this.sessionStart) / 1000),
    };
  }

  /** Reset session tracking */
  reset() {
    this.calls = [];
    this.sessionStart = Date.now();
  }
}

// Singleton instance shared across the server process
export const loadBalancer = new LoadBalancer();
