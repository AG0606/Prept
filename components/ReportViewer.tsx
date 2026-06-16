'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { generateReport } from '@/lib/reportGenerator';
import type { SessionReport, TurnSummary } from '@/types';
import { Loader2, FileText, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { DiffFeedbackTable } from './DiffFeedbackTable';

interface ReportViewerProps {
  data: {
    turns: TurnSummary[];
    jobProfile: string;
    candidateName: string;
    sessionStartTime: number;
    mode: string;
    overallScore?: number;
    emotionTimeline?: import('@/types').EmotionReading[];
  };
}

export function ReportViewer({ data }: ReportViewerProps) {
  const { turns, jobProfile, candidateName, sessionStartTime, mode } = data;
  const [downloading, setDownloading] = useState(false);
  const [evaluation, setEvaluation] = useState<{impression: string, recommendations: string[]}>({
    impression: 'Analyzing session data to generate final impression...',
    recommendations: []
  });
  const [evalLoading, setEvalLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    const updateTheme = () => setThemeKey(prev => prev + 1);
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (turns.length === 0) {
      setEvalLoading(false);
      return;
    }

    let isMounted = true;
    fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns, jobProfile, candidateName })
    })
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.impression) {
          setEvaluation({ impression: data.impression, recommendations: data.recommendations || [] });
        }
        if (isMounted) setEvalLoading(false);
      })
      .catch(() => {
        if (isMounted) setEvalLoading(false);
      });
    
    return () => { isMounted = false; };
  }, [turns, jobProfile, candidateName]);

  const overallScores = useCallback(() => {
    if (turns.length === 0) {
      return { communication: 5, confidence: 5, technicalDepth: 5, structure: 5, overall: 5 };
    }
    const vocalTurns = turns.filter(t => !(t.questionType === 'coding' && !t.followUpAsked));
    const avgQuality = turns.reduce((a, t) => a + t.scores.quality, 0) / turns.length;
    const avgFillerPenalty = Math.max(0, 10 - (vocalTurns.length > 0 ? vocalTurns.reduce((a, t) => a + t.scores.fillerDensity, 0) / vocalTurns.length : 0));
    return {
      communication: Math.round(avgFillerPenalty * 10) / 10,
      confidence: Math.round((avgQuality * 0.8 + 2) * 10) / 10,
      technicalDepth: Math.round(avgQuality * 10) / 10,
      structure: Math.round((avgQuality * 0.9 + 1) * 10) / 10,
      overall: Math.round(avgQuality * 10) / 10,
    };
  }, [turns]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || turns.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scores = overallScores();
    const labels = ['Communication', 'Confidence', 'Technical', 'Structure', 'Overall'];
    const values = [scores.communication, scores.confidence, scores.technicalDepth, scores.structure, scores.overall];
    const cx = 150, cy = 150, r = 100;

    ctx.clearRect(0, 0, 300, 300);

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.08)';
    const radarFill = isDark ? 'rgba(91, 91, 255, 0.1)' : 'rgba(91, 91, 255, 0.15)';
    const textColor = isDark ? '#94A3B8' : '#64748B';

    for (let level = 2; level <= 10; level += 2) {
      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      for (let i = 0; i <= 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const x = cx + (r * level / 10) * Math.cos(angle);
        const y = cy + (r * level / 10) * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = radarFill;
    ctx.strokeStyle = '#5B5BFF';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 5; i++) {
      const idx = i % 5;
      const angle = (Math.PI * 2 * idx) / 5 - Math.PI / 2;
      const val = values[idx] / 10;
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const x = cx + (r + 18) * Math.cos(angle);
      const y = cy + (r + 18) * Math.sin(angle);
      ctx.fillText(labels[i].toUpperCase(), x, y);
    }
  }, [turns, overallScores, themeKey]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const scores = overallScores();
      const duration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 60000) : 30;

      const report: SessionReport = {
        candidateName,
        jobRole: jobProfile,
        date: new Date().toLocaleDateString(),
        duration,
        turns,
        emotionTimeline: data.emotionTimeline?.map(e => ({ timestamp: e.timestamp, emotion: e.dominant })) || [],
        audioMetrics: { 
          avgWpm: (() => {
            const vocalTurns = turns.filter(t => !(t.questionType === 'coding' && !t.followUpAsked));
            return vocalTurns.length > 0 ? Math.round(vocalTurns.reduce((acc, t) => acc + (t.scores.wpm || 0), 0) / vocalTurns.length) : 130;
          })(),
          avgLoudnessDb: -20 
        },
        overallScores: scores,
        geminiImpression: evaluation.impression,
        recommendations: evaluation.recommendations.length > 0 ? evaluation.recommendations : [
          'Practice structuring answers using the STAR method',
          'Reduce filler word usage through deliberate pausing',
        ],
      };

      const blob = await generateReport(report);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interview-report-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const scores = overallScores();

  return (
    <div className="flex flex-col gap-8 pb-12 w-full max-w-6xl mx-auto mt-8 px-6 text-fg bg-bg">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-fg mb-1.5">Performance Report</h2>
          <p className="text-fg-muted font-grotesk text-xs uppercase tracking-wide">
            {candidateName} <span className="mx-2 text-border">|</span> {jobProfile} <span className="mx-2 text-border">|</span> Mode: {mode}
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="prept-btn-secondary"
        >
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          {downloading ? 'GENERATING...' : 'DOWNLOAD PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Radar Chart */}
        <div className="col-span-1 prept-card p-6 flex flex-col items-center">
          <h3 className="prept-label mb-6 w-full text-left">Dimensional Analysis</h3>
          <canvas ref={canvasRef} width={300} height={300} className="w-full max-w-[250px] aspect-square" />
        </div>

        {/* Score Grid */}
        <div className="col-span-1 lg:col-span-2 grid grid-cols-2 gap-4">
          {Object.entries(scores).map(([key, value]) => {
            const isHigh = value >= 7;
            const isMid = value >= 5 && value < 7;
            const colorClass = isHigh ? 'text-success' : isMid ? 'text-warn' : 'text-danger';

            return (
              <div key={key} className="prept-card p-6 flex flex-col justify-center">
                <div className="prept-label mb-2">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-bold tracking-tight font-mono ${colorClass}`}>
                    {value.toFixed(1)}
                  </span>
                  <span className="text-xs text-fg-muted font-mono">/10.0</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Evaluation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <div className="prept-card p-6">
          <h3 className="prept-label mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            AI Interviewer Impression
          </h3>
          {evalLoading ? (
            <div className="flex items-center gap-3 text-fg-muted font-mono text-xs">
              <Loader2 size={14} className="animate-spin text-accent" /> Generating impression...
            </div>
          ) : (
            <p className="text-fg text-sm leading-relaxed font-sans">{evaluation.impression}</p>
          )}
        </div>
        <div className="prept-card p-6">
          <h3 className="prept-label mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            Key Recommendations
          </h3>
          {evalLoading ? (
            <div className="flex items-center gap-3 text-fg-muted font-mono text-xs">
              <Loader2 size={14} className="animate-spin text-secondary" /> Identifying areas for improvement...
            </div>
          ) : evaluation.recommendations.length > 0 ? (
            <ul className="space-y-3 font-sans text-sm">
              {evaluation.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2.5 text-fg items-start">
                  <span className="text-accent mt-1 shrink-0">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted text-xs italic font-mono">No specific recommendations generated.</p>
          )}
        </div>
      </div>

      {/* Transcript / Questions */}
      <div>
        <h3 className="prept-label mb-6">Vector Transcript</h3>
        <div className="space-y-4">
          {turns.map((turn, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              key={turn.questionId} 
              className="prept-card p-6 relative hover:border-accent/30 transition-colors"
            >
              <div className="flex gap-4">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <span className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center font-mono text-xs font-bold text-fg-subtle">
                    {i + 1}
                  </span>
                  {i !== turns.length - 1 && <div className="w-px h-full bg-border mt-4" />}
                </div>
                
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <span className="inline-block px-2 py-0.5 mb-2 rounded bg-accent-muted border border-accent/20 text-[9px] font-bold font-mono uppercase tracking-wider text-accent">
                        {turn.questionType || 'Behavioral'}
                      </span>
                      <h4 className="text-base font-bold text-fg">{turn.question}</h4>
                    </div>
                    <div className={`flex items-center justify-center w-10 h-10 rounded-lg border border-border font-mono font-bold text-sm ${turn.scores.quality >= 7 ? 'text-success bg-success-muted' : turn.scores.quality >= 5 ? 'text-warn bg-warn-muted' : 'text-danger bg-danger-muted'}`}>
                      {turn.scores.quality}
                    </div>
                  </div>
                  
                  <div className="bg-surface-raised rounded-lg p-4 border border-border text-sm text-fg leading-relaxed mb-4">
                    <p className="prept-label !text-[9px] !text-accent mb-2">Response Summary</p>
                    {turn.answerSummary}
                  </div>

                  {turn.questionType === 'coding' && !turn.followUpAsked ? (
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-accent-muted border border-accent/20 rounded-full text-[10px] font-mono text-accent">
                        Coding Phase (No Speech)
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-surface-raised border border-border rounded-full text-[10px] font-mono text-fg-muted">
                        Fillers: <strong className="text-fg">{turn.scores.fillerDensity.toFixed(1)}%</strong>
                      </span>
                      <span className="px-3 py-1 bg-surface-raised border border-border rounded-full text-[10px] font-mono text-fg-muted capitalize">
                        Sentiment: <strong className="text-fg">{turn.scores.sentiment}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
