'use client';
// ════════════════════════════════════════════════════════════
// Filler Counter — Real-Time Filler Detection Display
// ════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { detectFillers, getFillerFeedback } from '@/lib/fillerDetector';
import { useInterviewStore } from '@/store/interviewStore';

export function FillerCounter() {
  const transcript = useInterviewStore((s) => s.transcript);
  const fillerCount = useInterviewStore((s) => s.fillerCount);
  const fillerDensity = useInterviewStore((s) => s.fillerDensity);
  const setFillerCount = useInterviewStore((s) => s.setFillerCount);

  useEffect(() => {
    if (!transcript) return;
    const result = detectFillers(transcript);
    setFillerCount(result.count, result.density);
  }, [transcript, setFillerCount]);

  const feedback = getFillerFeedback(fillerDensity);
  const color =
    fillerDensity < 2
      ? 'var(--color-success)'
      : fillerDensity < 5
        ? 'var(--color-warning)'
        : fillerDensity < 10
          ? 'var(--color-caution)'
          : 'var(--color-danger)';

  return (
    <div className="metric-card" id="filler-counter">
      <div className="metric-label">Fillers</div>
      <div className="metric-value" style={{ color }}>
        {fillerCount}
      </div>
      <div className="metric-sub" style={{ color }}>
        {fillerDensity.toFixed(1)}% density
      </div>
      <div className="metric-feedback">{feedback}</div>
    </div>
  );
}
