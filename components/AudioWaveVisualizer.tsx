'use client';

/**
 * AudioWaveVisualizer — Animated audio wave bars for the AI coach section.
 * From the simulator design asset: accent-colored bars bouncing at different speeds.
 */

interface AudioWaveVisualizerProps {
  barCount?: number;
  maxHeight?: number;
  color?: string;
  className?: string;
}

export function AudioWaveVisualizer({
  barCount = 12,
  maxHeight = 60,
  color = 'var(--accent, #5B5BFF)',
  className = '',
}: AudioWaveVisualizerProps) {
  // Generate varied animation durations and delays for organic feel
  const bars = Array.from({ length: barCount }, (_, i) => ({
    duration: 0.3 + Math.sin(i * 0.8) * 0.25 + (i % 3) * 0.15,
    delay: i * 0.08,
    minHeight: 4 + (i % 4) * 2,
  }));

  return (
    <div
      className={`flex items-center gap-[3px] ${className}`}
      style={{ height: maxHeight }}
    >
      {bars.map((bar, i) => (
        <div
          key={i}
          className="flex-1 min-w-[3px] max-w-[6px]"
          style={{
            background: color,
            height: `${bar.minHeight}px`,
            animation: `audioWaveBounce ${bar.duration}s ${bar.delay}s infinite alternate ease-in-out`,
          }}
        />
      ))}
    </div>
  );
}
