'use client';

import { useInterviewStore } from '@/store/interviewStore';
import { Smile, Meh, Frown, Angry, AlertTriangle, HelpCircle, ThumbsUp, ThumbsDown, Minus, Volume2, Activity, Zap, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export function ScorePanel() {
  const emotion = useInterviewStore((s) => s.currentEmotion);
  const loudness = useInterviewStore((s) => s.loudnessDb);
  const wpm = useInterviewStore((s) => s.wordsPerMinute);
  const fillerCount = useInterviewStore((s) => s.fillerCount);
  const fillerDensity = useInterviewStore((s) => s.fillerDensity);
  const sentiment = useInterviewStore((s) => s.sentimentLabel);
  const quality = useInterviewStore((s) => s.qualityScore);

  const emotionIcon: Record<string, React.ReactNode> = {
    neutral: <Meh size={16} className="text-fg-muted" />,
    happy: <Smile size={16} className="text-success animate-pulse" />,
    sad: <Frown size={16} className="text-accent" />,
    angry: <Angry size={16} className="text-danger" />,
    fearful: <AlertTriangle size={16} className="text-warn animate-bounce" />,
    disgusted: <Frown size={16} className="text-success" />,
    surprised: <HelpCircle size={16} className="text-accent" />,
  };

  const getPaceStatus = (wordsPerMin: number) => {
    if (wordsPerMin === 0) return { label: 'Silent', color: 'text-fg-muted', bg: 'bg-surface-warm border-border' };
    if (wordsPerMin >= 120 && wordsPerMin <= 160) {
      return { label: 'Optimal Pace', color: 'text-success', bg: 'bg-success/10 border-success/20' };
    }
    if (wordsPerMin > 160) {
      return { label: 'Speaking Fast', color: 'text-warn', bg: 'bg-warn/10 border-warn/20' };
    }
    return { label: 'Speaking Slow', color: 'text-accent', bg: 'bg-accent/10 border-accent/20' };
  };

  const getFillerStatus = (density: number) => {
    if (density < 2) return { color: 'text-success', label: 'Excellent' };
    if (density < 5) return { color: 'text-warn', label: 'Moderate' };
    return { color: 'text-danger', label: 'High' };
  };

  const paceInfo = getPaceStatus(wpm);
  const fillerInfo = getFillerStatus(fillerDensity);

  return (
    <div className="flex flex-col gap-4 p-5 rounded-xl saas-card">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-xs font-mono font-bold text-fg-muted uppercase tracking-widest flex items-center gap-2">
          <Activity size={14} className="text-fg-muted" />
          Live Telemetry
        </h3>
        {wpm > 0 && (
          <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold border uppercase ${paceInfo.bg} ${paceInfo.color}`}>
            {paceInfo.label}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Quality Score Indicator */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border shadow-sm text-sm">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-fg-muted" />
            <span className="font-mono text-fg-muted">TURN RATING</span>
          </div>
          <span className={`font-bold font-mono text-sm ${quality >= 7 ? 'text-success' : quality >= 5 ? 'text-warn' : 'text-danger'}`}>
            {quality > 0 ? `${quality}.0/10` : '—'}
          </span>
        </div>

        {/* Real-time Loudness Slider/Indicator */}
        <div className="p-3 rounded-lg bg-bg border border-border shadow-sm flex flex-col gap-2.5 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 size={14} className="text-fg-muted" />
              <span className="font-mono text-fg-muted">MICROPHONE INPUT</span>
            </div>
            <span className="font-mono text-[10px] text-fg-muted">{Math.max(-60, Math.round(loudness))} dB</span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, ((loudness + 60) / 60) * 100))}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
            />
          </div>
        </div>

        {/* Emotion Reading */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border shadow-sm text-sm">
          <div className="flex items-center gap-2">
            {emotionIcon[emotion?.dominant ?? 'neutral']}
            <span className="font-mono text-fg-muted">DOMINANT EMOTION</span>
          </div>
          <span className="font-mono font-bold capitalize text-fg">
            {emotion?.dominant ?? 'detecting...'}
          </span>
        </div>

        {/* Pace (WPM) */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border shadow-sm text-sm">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-fg-muted" />
            <span className="font-mono text-fg-muted">SPEAKING PACE</span>
          </div>
          <span className={`font-bold font-mono text-sm ${paceInfo.color}`}>
            {wpm} <span className="text-[10px] text-fg-muted font-normal font-sans">WPM</span>
          </span>
        </div>

        {/* Fillers & Density */}
        <div className="p-3 rounded-lg bg-bg border border-border shadow-sm flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-fg-muted">FILLER DENSITY</span>
            <span className={`font-bold font-mono ${fillerInfo.color}`}>{fillerCount} <span className="text-[10px] text-fg-muted font-normal">words</span></span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-fg-muted font-mono">
            <span>RATIO</span>
            <span>{fillerDensity.toFixed(1)}% ({fillerInfo.label})</span>
          </div>
        </div>

        {/* Sentiment / Tone */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border shadow-sm text-sm">
          <span className="font-mono text-fg-muted">SENTIMENT TONE</span>
          <div className="flex items-center gap-1.5">
            {sentiment === 'positive' ? (
              <span className="flex items-center gap-1 text-success font-bold text-xs font-mono">
                <ThumbsUp size={14} /> POSITIVE
              </span>
            ) : sentiment === 'negative' ? (
              <span className="flex items-center gap-1 text-danger font-bold text-xs font-mono">
                <ThumbsDown size={14} /> NEGATIVE
              </span>
            ) : (
              <span className="flex items-center gap-1 text-fg-muted font-bold text-xs font-mono">
                <Minus size={14} /> NEUTRAL
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
