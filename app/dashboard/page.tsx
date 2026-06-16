'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { ResumeUploader } from '@/components/ResumeUploader';
import { useInterviewStore } from '@/store/interviewStore';
import { LogOut, FileText, Play, Settings, BarChart, Clock, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PreptWordmark } from '@/components/PreptLogo';

const JOB_ROLES = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'Data Scientist', 'Machine Learning Engineer',
  'Product Manager', 'Other'
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const resumeData = useInterviewStore((s) => s.resumeData);
  const setResumeData = useInterviewStore((s) => s.setResumeData);
  const jobProfile = useInterviewStore((s) => s.jobProfile);
  const setJobProfile = useInterviewStore((s) => s.setJobProfile);
  const mode = useInterviewStore((s) => s.mode);
  const setMode = useInterviewStore((s) => s.setMode);
  const techSplit = useInterviewStore((s) => s.techSplit);
  const hrSplit = useInterviewStore((s) => s.hrSplit);
  const codeSplit = useInterviewStore((s) => s.codeSplit);
  const setSplits = useInterviewStore((s) => s.setSplits);
  const startSession = useInterviewStore((s) => s.startSession);
  
  const [customRole, setCustomRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'resumes' | 'history'>('home');
  const [resumes, setResumes] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const fetchDashboardData = useCallback(async () => {
    if (status === 'authenticated') {
      try {
        const resResumes = await fetch('/api/resume');
        if (resResumes.ok) {
          const data = await resResumes.json();
          if (data && data.resumes) {
            setResumes(data.resumes);
            const current = data.resumes.find((r: any) => r.isCurrent) || data.resumes[0];
            if (current) setResumeData(current);
          }
        }
        
        const resHistory = await fetch('/api/history');
        if (resHistory.ok) {
          const histData = await resHistory.json();
          setHistory(histData.interviews || []);
        }
      } catch (e) {
        console.error("Failed to fetch dashboard data", e);
      } finally {
        setLoading(false);
      }
    }
  }, [status, setResumeData]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleStart = () => {
    if (jobProfile === 'Other' && customRole) {
      setJobProfile(customRole);
    }
    startSession();
    router.push('/interview');
  };

  const handleSliderChange = (type: 'tech' | 'hr' | 'code', value: number) => {
    let newTech = techSplit;
    let newHr = hrSplit;
    let newCode = codeSplit;
    
    if (type === 'tech') {
      newTech = value;
      const rem = 100 - newTech;
      const ratio = hrSplit + codeSplit > 0 ? hrSplit / (hrSplit + codeSplit) : 0.5;
      newHr = Math.round(rem * ratio);
      newCode = rem - newHr;
    } else if (type === 'hr') {
      newHr = value;
      const rem = 100 - newHr;
      const ratio = techSplit + codeSplit > 0 ? techSplit / (techSplit + codeSplit) : 0.5;
      newTech = Math.round(rem * ratio);
      newCode = rem - newTech;
    } else {
      newCode = value;
      const rem = 100 - newCode;
      const ratio = techSplit + hrSplit > 0 ? techSplit / (techSplit + hrSplit) : 0.5;
      newTech = Math.round(rem * ratio);
      newCode = rem - newTech;
    }
    setSplits(newTech, newHr, newCode);
  };

  const handleSetCurrentResume = async (id: string) => {
    try {
      await fetch('/api/resume', { method: 'PUT', body: JSON.stringify({ id }) });
      const updated = resumes.map(r => ({ ...r, isCurrent: r.id === id }));
      setResumes(updated);
      setResumeData(updated.find(r => r.id === id));
    } catch (e) {
      console.error(e);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-bg text-fg pb-20">
      {/* Top Navbar */}
      <nav className="prept-glass sticky top-0 z-50 border-b border-border-soft">
        <div className="max-w-[1180px] mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <PreptWordmark />
            <div className="hidden md:flex items-center gap-1 text-sm font-medium">
              <button onClick={() => setActiveTab('home')} className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'home' ? 'bg-accent-muted text-accent font-semibold' : 'text-fg-muted hover:text-fg'}`}>Dashboard</button>
              <button onClick={() => setActiveTab('resumes')} className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'resumes' ? 'bg-accent-muted text-accent font-semibold' : 'text-fg-muted hover:text-fg'}`}>Assets</button>
              <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-accent-muted text-accent font-semibold' : 'text-fg-muted hover:text-fg'}`}>Review</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex items-center gap-3 pl-4 border-l border-border-soft">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-secondary p-[2px]">
                <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-accent font-bold text-sm">
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
          </div>
        </div>
      </nav>

      <main className="max-w-[1180px] mx-auto px-6 mt-12">
        <AnimatePresence mode="wait">
          
          {/* HOME TAB */}
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
              
              {/* Left Sidebar Profile */}
              <aside className="prept-card p-7 self-start space-y-6">
                <div className="flex gap-4 items-center">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-secondary p-[2px]">
                    <div className="w-full h-full rounded-xl bg-surface text-accent flex items-center justify-center font-bold text-xl">
                      {session.user?.name?.charAt(0) || 'U'}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{session.user?.name || 'User'}</h3>
                    <p className="text-sm text-fg-muted">Candidate</p>
                  </div>
                </div>
                
                {resumeData ? (
                  <div className="space-y-4 pt-4 border-t border-border-soft">
                    <p className="prept-label">Active Profile</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-accent-muted/30">
                        <span className="block text-2xl font-bold font-mono tracking-tight">{Array.isArray(resumeData.skills) ? resumeData.skills.length : 0}</span>
                        <span className="text-xs text-fg-muted">skills</span>
                      </div>
                      <div className="p-3 rounded-lg bg-accent-muted/30">
                        <span className="block text-2xl font-bold font-mono tracking-tight">{resumeData.rating ? `${resumeData.rating}` : '-'}</span>
                        <span className="text-xs text-fg-muted">AI rating</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-border-soft text-sm text-fg-muted">
                    No active resume profile. Upload one in Assets.
                  </div>
                )}

                <div className="space-y-4 pt-4 border-t border-border-soft">
                   <p className="prept-label">Telemetry</p>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-fg-muted">Total Sessions</span>
                     <span className="font-bold">{history.length}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-fg-muted">Avg. Score</span>
                     <span className="font-bold">{history.length ? `${(history.reduce((a, b) => a + (b.overallScore || 0), 0) / history.length).toFixed(1)}/10` : '—'}</span>
                   </div>
                </div>
              </aside>

              {/* Main Content Area */}
              <div className="space-y-6">
                
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="prept-label mb-2">Preparation state</p>
                    <h2 className="text-2xl font-extrabold tracking-tight">Configure Next Session</h2>
                  </div>
                  {mode === 'practice' ? (
                    <span className="px-3 py-1 bg-accent-muted text-accent rounded-full text-xs font-mono hidden md:inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent"></span> Practice Sandbox
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-success-muted text-success rounded-full text-xs font-mono hidden md:inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success"></span> Real Interview
                    </span>
                  )}
                </div>

                <div className="prept-card p-8">
                  <div className="space-y-8">
                    {/* Role */}
                    <div>
                      <p className="text-sm font-bold text-fg mb-3">1. Target Role</p>
                      <div className="flex flex-wrap gap-2">
                        {JOB_ROLES.map((role) => (
                          <button
                            key={role}
                            className={`px-4 py-2 rounded-lg text-sm transition-all border ${jobProfile === role ? 'bg-accent text-accent-on border-accent shadow-sm' : 'bg-surface hover:bg-accent-muted border-border'}`}
                            onClick={() => { setJobProfile(role); if (role !== 'Other') setCustomRole(''); }}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                      {jobProfile === 'Other' && (
                        <input
                          type="text"
                          className="prept-input w-full mt-3"
                          placeholder="Custom Role (e.g., Security Engineer)"
                          value={customRole}
                          onChange={(e) => setCustomRole(e.target.value)}
                        />
                      )}
                    </div>

                    {/* Mode */}
                    <div>
                      <p className="text-sm font-bold text-fg mb-3">2. Simulation Mode</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                          onClick={() => setMode('real')}
                          className={`p-5 rounded-xl text-left border-l-4 border transition-all ${mode === 'real' ? 'bg-surface border-success ring-2 ring-success shadow-sm' : 'bg-surface border-l-transparent border-border hover:border-fg-muted'}`}
                        >
                          <h4 className="font-bold text-fg mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-success" />
                            Real Interview
                          </h4>
                          <p className="text-sm text-fg-muted leading-relaxed">Strict evaluation standards. Live telemetry is hidden during interview turns. 12 fixed questions.</p>
                        </button>
                        <button 
                          onClick={() => setMode('practice')}
                          className={`p-5 rounded-xl text-left border-l-4 border transition-all ${mode === 'practice' ? 'bg-surface border-accent ring-2 ring-accent shadow-sm' : 'bg-surface border-l-transparent border-border hover:border-fg-muted'}`}
                        >
                          <h4 className="font-bold text-fg mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent" />
                            Practice Sandbox
                          </h4>
                          <p className="text-sm text-fg-muted leading-relaxed">Customizable mixes of tech/coding/HR topics. Live emotion & speaking pace indicators displayed.</p>
                        </button>
                      </div>
                    </div>

                    {/* Sliders (Only if Practice) */}
                    {mode === 'practice' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <p className="text-sm font-bold text-fg mb-3">3. Question Mix</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-surface-warm rounded-xl p-6">
                          <div>
                            <div className="flex justify-between text-xs font-mono mb-2"><span>Tech</span><span>{techSplit}%</span></div>
                            <input type="range" min="0" max="100" value={techSplit} onChange={(e) => handleSliderChange('tech', Number(e.target.value))} className="w-full accent-[var(--accent)] bg-border h-1.5 rounded-lg appearance-none cursor-pointer" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-mono mb-2"><span>Behavioral</span><span>{hrSplit}%</span></div>
                            <input type="range" min="0" max="100" value={hrSplit} onChange={(e) => handleSliderChange('hr', Number(e.target.value))} className="w-full accent-[var(--accent)] bg-border h-1.5 rounded-lg appearance-none cursor-pointer" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-mono mb-2"><span>Coding</span><span>{codeSplit}%</span></div>
                            <input type="range" min="0" max="100" value={codeSplit} onChange={(e) => handleSliderChange('code', Number(e.target.value))} className="w-full accent-[var(--accent)] bg-border h-1.5 rounded-lg appearance-none cursor-pointer" />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <button
                      onClick={handleStart}
                      disabled={!resumeData || !(jobProfile || customRole)}
                      className="prept-btn-gradient w-full h-12 justify-center text-base mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={18} className="fill-current" />
                      Initiate {mode === 'real' ? 'Interview' : 'Practice'} Room
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ASSETS TAB */}
          {activeTab === 'resumes' && (
            <motion.div key="resumes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="prept-label mb-2">Asset Gallery</p>
                  <h2 className="text-2xl font-extrabold tracking-tight">Resume Profiles</h2>
                </div>
                <button onClick={() => setIsUploading(!isUploading)} className="prept-btn-secondary">
                  <Plus size={16} /> Upload New
                </button>
              </div>

              {isUploading && (
                <div className="prept-card p-6 mb-8">
                  <ResumeUploader onUploadSuccess={() => {
                    setIsUploading(false);
                    fetchDashboardData();
                  }} />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resumes.map((res) => (
                  <div key={res.id} className={`prept-bento-card p-6 transition-all ${res.isCurrent ? 'ring-2 ring-accent shadow-md' : ''}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="prept-icon-badge w-10 h-10 rounded-lg flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      {res.isCurrent && <span className="bg-accent text-accent-on rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest">Active</span>}
                    </div>
                    
                    <h3 className="font-bold text-lg mb-1 truncate">{res.name}</h3>
                    <p className="text-xs text-fg-muted font-mono mb-4">{new Date(res.updatedAt).toLocaleDateString()}</p>
                    
                    {res.suggestions && (
                      <div className="text-sm text-fg-muted mb-6 bg-surface-warm rounded-lg p-3 border border-border-soft line-clamp-3">
                        {res.suggestions}
                      </div>
                    )}

                    {!res.isCurrent && (
                      <button onClick={() => handleSetCurrentResume(res.id)} className="w-full prept-btn-secondary justify-center text-xs">
                        Set as Active
                      </button>
                    )}
                  </div>
                ))}
                {resumes.length === 0 && !isUploading && (
                  <div className="col-span-full prept-panel border-dashed border-2 py-24 text-center">
                    <p className="text-fg-muted font-medium mb-4">No assets found.</p>
                    <button onClick={() => setIsUploading(true)} className="prept-btn-gradient">Upload your first resume</button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="mb-8">
                <p className="prept-label mb-2">Review</p>
                <h2 className="text-2xl font-extrabold tracking-tight">Interview Records</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map((session) => (
                  <div 
                    key={session.id} 
                    onClick={() => router.push(`/report?id=${session.id}`)}
                    className="prept-bento-card p-6 cursor-pointer flex flex-col justify-between min-h-[200px]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${session.mode === 'real' ? 'bg-success-muted text-success' : 'bg-accent-muted text-accent'}`}>
                          {session.mode}
                        </span>
                        <Clock size={14} className="text-fg-subtle" />
                      </div>
                      <h3 className="font-bold text-lg mb-1 line-clamp-2">{session.jobProfile}</h3>
                      <p className="text-xs text-fg-muted font-mono">{new Date(session.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex justify-between items-end mt-6 pt-4 border-t border-border-soft">
                      <span className="text-xs text-fg-muted font-medium">Score</span>
                      <span className={`font-bold font-mono text-2xl leading-none ${session.overallScore >= 7 ? 'text-success' : session.overallScore >= 5 ? 'text-warn' : 'text-danger'}`}>
                        {session.overallScore ? `${session.overallScore}/10` : '-'}
                      </span>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="col-span-full prept-panel border-dashed border-2 py-24 text-center">
                    <p className="text-fg-muted font-medium mb-4">No previous interviews found.</p>
                    <button onClick={() => setActiveTab('home')} className="prept-btn-gradient">Start a practice session</button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          
        </AnimatePresence>
      </main>
    </div>
  );
}
