'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useInterviewStore } from '@/store/interviewStore';
import { ReportViewer } from '@/components/ReportViewer';
import { PreptWordmark } from '@/components/PreptLogo';
import { ClipboardList, RotateCcw, ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useState, Suspense } from 'react';

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const historyId = searchParams.get('id');
  
  const phase = useInterviewStore((s) => s.phase);
  const turns = useInterviewStore((s) => s.turns);
  const storeResume = useInterviewStore((s) => s.resumeData);
  const storeJobProfile = useInterviewStore((s) => s.jobProfile);
  const storeMode = useInterviewStore((s) => s.mode);
  const storeStartTime = useInterviewStore((s) => s.sessionStartTime);
  const resetSession = useInterviewStore((s) => s.resetSession);
  
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [loading, setLoading] = useState(!!historyId);

  useEffect(() => {
    if (historyId) {
      fetch(`/api/history/${historyId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setHistoricalData(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [historyId]);

  const handleNewInterview = () => {
    resetSession();
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-bg text-fg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-accent" />
          <p className="prept-label">Retrieving Session Data...</p>
        </div>
      </main>
    );
  }

  // If no interview data, show empty state
  if (!historyId && phase !== 'complete' && turns.length === 0) {
    return (
      <main className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center">
        <div className="prept-card p-12 flex flex-col items-center text-center max-w-md">
          <div className="text-fg-subtle mb-6"><ClipboardList size={48} /></div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">No Session Data</h1>
          <p className="text-fg-muted mb-8">Complete an interview session to view your performance report, or select a past session from the dashboard.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="prept-btn-gradient w-full py-3 rounded-lg font-bold uppercase tracking-widest"
          >
            GO TO DASHBOARD
          </button>
        </div>
      </main>
    );
  }

  const reportData = historicalData ? {
    turns: historicalData.turns || [],
    jobProfile: historicalData.jobProfile || 'Unknown Role',
    candidateName: historicalData.resume?.name || 'Candidate',
    sessionStartTime: new Date(historicalData.createdAt).getTime(),
    mode: historicalData.mode || 'practice',
    overallScore: historicalData.overallScore
  } : {
    turns,
    jobProfile: storeJobProfile,
    candidateName: storeResume?.name || 'Candidate',
    sessionStartTime: storeStartTime,
    mode: storeMode,
    emotionTimeline: useInterviewStore.getState().emotionHistory
  };

  return (
    <main className="min-h-screen bg-bg text-fg flex flex-col">
      {/* Header */}
      <header className="prept-glass h-16 border-b border-border flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <PreptWordmark />
          {historyId && (
            <button 
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-fg-muted hover:text-fg font-grotesk text-xs tracking-widest uppercase transition-colors"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
          )}
        </div>
        {!historyId && (
          <button
            onClick={handleNewInterview}
            className="prept-btn-gradient flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-widest"
          >
            <RotateCcw size={16} /> NEW SESSION
          </button>
        )}
      </header>

      {/* Report Content */}
      <ReportViewer data={reportData} />
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg text-fg flex items-center justify-center"><Loader2 size={32} className="animate-spin text-accent" /></div>}>
      <ReportContent />
    </Suspense>
  );
}
