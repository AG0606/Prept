'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SkillAnalyticsProps {
  history: any[];
}

export function SkillAnalyticsRadar({ history }: SkillAnalyticsProps) {
  if (!history || history.length === 0) {
    return null;
  }

  // Calculate dynamic dimensions from history
  const totalSessions = history.length;
  const avgScore = history.reduce((acc, h) => acc + (h.overallScore || 6.5), 0) / totalSessions;
  
  // Calculate synthetic radar dimensions (scaled 0 to 100)
  const technicalScore = Math.min(100, Math.round(avgScore * 9.5));
  const starStructureScore = Math.min(100, Math.round((avgScore * 8.8) + (totalSessions > 2 ? 8 : 0)));
  const communicationScore = Math.min(100, Math.round((avgScore * 9.2) + 5));
  const composureScore = Math.min(100, Math.round((avgScore * 8.5) + (totalSessions * 2)));

  const dimensions = [
    { label: 'Technical Depth', value: technicalScore },
    { label: 'STAR Structure', value: starStructureScore },
    { label: 'Communication Clarity', value: communicationScore },
    { label: 'Composure & Pace', value: composureScore },
  ];

  // SVG Radar coordinates calculation (Center: 120, 120, Radius: 90)
  const center = 120;
  const radius = 80;
  const numPoints = dimensions.length;

  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 / numPoints) * index - Math.PI / 2;
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const radarPoints = dimensions
    .map((dim, i) => {
      const { x, y } = getCoordinates(i, dim.value);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="prept-card p-6 bg-surface border border-border">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* SVG Radar Chart */}
        <div className="relative w-[260px] h-[260px] flex items-center justify-center">
          <svg width="240" height="240" className="overflow-visible">
            {/* Background Grid Rings */}
            {[0.25, 0.5, 0.75, 1].map((scale, idx) => (
              <polygon
                key={idx}
                points={dimensions
                  .map((_, i) => {
                    const { x, y } = getCoordinates(i, scale * 100);
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="var(--border)"
                strokeDasharray={scale === 1 ? 'none' : '2,2'}
                strokeWidth="1"
              />
            ))}

            {/* Crosshair Axes */}
            {dimensions.map((_, i) => {
              const { x, y } = getCoordinates(i, 100);
              return (
                <line
                  key={i}
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Data Polygon */}
            <motion.polygon
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              points={radarPoints}
              fill="rgba(91, 91, 255, 0.25)"
              stroke="var(--accent)"
              strokeWidth="2"
            />

            {/* Data Points */}
            {dimensions.map((dim, i) => {
              const { x, y } = getCoordinates(i, dim.value);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>
        </div>

        {/* Dimension Metrics */}
        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border-soft">
            <span className="prept-label">Competency Dimension</span>
            <span className="prept-label">Mastery Index</span>
          </div>

          {dimensions.map((dim) => (
            <div key={dim.label} className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-fg-muted">{dim.label}</span>
                <span className="font-bold text-accent">{dim.value}%</span>
              </div>
              <div className="w-full bg-surface-warm h-1.5 border border-border-soft">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${dim.value}%` }}
                  transition={{ duration: 0.6 }}
                  className="h-full bg-accent"
                />
              </div>
            </div>
          ))}

          <div className="pt-3 flex justify-between items-center text-xs font-mono text-fg-muted">
            <span>Aggregated from {totalSessions} completed {totalSessions === 1 ? 'session' : 'sessions'}</span>
            <span className="text-success font-bold">{(avgScore).toFixed(1)}/10 Avg</span>
          </div>
        </div>

      </div>
    </div>
  );
}
