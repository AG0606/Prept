'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useInterviewStore } from '@/store/interviewStore';
import { ReportViewer } from '@/components/ReportViewer';
import { PreptWordmark } from '@/components/PreptLogo';
import { useSession, signOut } from 'next-auth/react';
import { ClipboardList, RotateCcw, ArrowLeft, Loader2, LogOut } from 'lucide-react';
import { useEffect, useState, Suspense } from 'react';

function ReportContent() {
  const { data: session } = useSession();
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

  const navigateTab = (tab: 'home' | 'resumes' | 'history') => {
    resetSession();
    if (tab === 'home') router.push('/dashboard');
    else router.push(`/dashboard?tab=${tab}`);
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
    candidateName: historicalData.resume?.name || session?.user?.name || 'Candidate',
    sessionStartTime: new Date(historicalData.createdAt).getTime(),
    mode: historicalData.mode || 'practice',
    overallScore: historicalData.overallScore
  } : {
    turns,
    jobProfile: storeJobProfile,
    candidateName: storeResume?.name || session?.user?.name || 'Candidate',
    sessionStartTime: storeStartTime,
    mode: storeMode,
    emotionTimeline: useInterviewStore.getState().emotionHistory
  };

  return (
    <main className="min-h-screen bg-bg text-fg flex flex-col">
      {/* Top Navbar with Standard 3 Headers */}
      <header className="prept-glass h-16 border-b border-border flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <PreptWordmark />
          <div className="hidden md:flex items-center gap-1 text-sm font-medium">
            <button
              onClick={() => navigateTab('home')}
              className="px-4 py-2 rounded-lg text-fg-muted hover:text-fg transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigateTab('resumes')}
              className="px-4 py-2 rounded-lg text-fg-muted hover:text-fg transition-colors"
            >
              Assets
            </button>
            <button
              onClick={() => navigateTab('history')}
              className="px-4 py-2 rounded-lg bg-accent-muted text-accent font-semibold transition-colors"
            >
              Review
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleNewInterview}
            className="prept-btn-gradient flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest"
          >
            <RotateCcw size={14} /> NEW SESSION
          </button>

          {session && (
            <div className="flex items-center gap-3 pl-2 border-l border-border-soft">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-secondary p-[2px]">
                <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-accent font-bold text-xs">
                  {session.user?.name?.charAt(0) || 'U'}
                </div>
              </div>
              <button 
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-fg-muted hover:text-fg transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
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
