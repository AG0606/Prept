'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { ResumeUploader } from '@/components/ResumeUploader';
import { ResumeDetailModal } from '@/components/ResumeDetailModal';
import { useInterviewStore } from '@/store/interviewStore';
import { LogOut, FileText, Play, Settings, BarChart, Clock, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PreptWordmark } from '@/components/PreptLogo';

import { SkillAnalyticsRadar } from '@/components/SkillAnalyticsRadar';
import type { InterviewerPersona, GapAnalysisResult } from '@/types';
import { Sparkles, Compass, Target, AlertTriangle } from 'lucide-react';

const JOB_ROLES = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'Data Scientist', 'Machine Learning Engineer',
  'Product Manager', 'Other'
];

const PERSONAS: { id: InterviewerPersona; title: string; subtitle: string; tag: string }[] = [
  { id: 'standard', title: 'Standard', subtitle: 'Balanced, structured & encouraging', tag: 'Balanced' },
  { id: 'faang', title: 'Big Tech / FAANG', subtitle: 'Heavy scale, system metrics & strict STAR', tag: 'High Rigor' },
  { id: 'startup', title: 'Startup VP', subtitle: 'Pragmatic, ownership & rapid execution', tag: 'Pragmatic' },
  { id: 'challenger', title: 'Challenger', subtitle: 'Deep follow-ups & probing assumptions', tag: 'Stress Probe' },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const resumeData = useInterviewStore((s) => s.resumeData);
  const setResumeData = useInterviewStore((s) => s.setResumeData);
  const jobProfile = useInterviewStore((s) => s.jobProfile);
  const setJobProfile = useInterviewStore((s) => s.setJobProfile);
  const jobDescription = useInterviewStore((s) => s.jobDescription);
  const setJobDescription = useInterviewStore((s) => s.setJobDescription);
  const interviewerPersona = useInterviewStore((s) => s.interviewerPersona);
  const setInterviewerPersona = useInterviewStore((s) => s.setInterviewerPersona);
  const gapAnalysis = useInterviewStore((s) => s.gapAnalysis);
  const setGapAnalysis = useInterviewStore((s) => s.setGapAnalysis);
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
  const [selectedResume, setSelectedResume] = useState<any | null>(null);
  
  const [showJdInput, setShowJdInput] = useState(false);
  const [isAnalyzingJd, setIsAnalyzingJd] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'resumes' || tabParam === 'history' || tabParam === 'home') {
        setActiveTab(tabParam);
      }
    }
  }, []);

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

  const handleCreateDemoResume = async () => {
    try {
      const samplePayload = {
        name: 'Senior Full Stack Engineer (Sample)',
        email: session?.user?.email || 'candidate@prept.internal',
        education: [{ degree: 'B.S. Computer Science', institution: 'University of Technology', year: '2022' }],
        experience: [{
          company: 'HyperScale Systems',
          role: 'Senior Software Engineer',
          duration: '2022 - Present',
          bulletPoints: [
            'Architected distributed event-driven microservices processing 50k req/sec.',
            'Optimized p99 query latency by 45% using Redis caching and Postgres partition indexing.',
            'Led migration to Next.js 14 App Router and TypeScript codebase.'
          ]
        }],
        skills: ['TypeScript', 'Next.js', 'React', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'System Design', 'TailwindCSS'],
        projects: [{
          name: 'Distributed Rate Limiter',
          description: 'Token-bucket rate limiter built with Go and Redis clusters.',
          techStack: ['Go', 'Redis', 'Docker']
        }],
        rawText: 'Senior Software Engineer specializing in distributed architectures and web applications.',
        rating: 8.8,
        suggestions: 'Quantify metrics on team leadership and scaling impact.',
      };

      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload),
      });

      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to create demo resume:', err);
    }
  };

  const handleAnalyzeJd = async () => {
    if (!jobDescription || jobDescription.trim().length < 20 || !resumeData) return;
    setIsAnalyzingJd(true);
    try {
      const res = await fetch('/api/jd-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription,
          resumeData,
          jobProfile: jobProfile || customRole || 'Software Engineer',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setGapAnalysis(data.analysis);
        }
      }
    } catch (e) {
      console.error('Failed to analyze JD:', e);
    } finally {
      setIsAnalyzingJd(false);
    }
  };

  const handleStart = () => {
    if (jobProfile === 'Other' && customRole) {
      setJobProfile(customRole);
    }
    startSession();
    router.push('/interview');
  };

  const handleSliderChange = (type: 'tech' | 'hr', value: number) => {
    let newTech = techSplit;
    let newHr = hrSplit;
    
    if (type === 'tech') {
      newTech = value;
      newHr = 100 - newTech;
    } else {
      newHr = value;
      newTech = 100 - newHr;
    }
    setSplits(newTech, newHr, 0);
  };

  const handleSetCurrentResume = async (id: string) => {
    try {
      await fetch('/api/resume', { method: 'PUT', body: JSON.stringify({ id }) });
      const updated = resumes.map(r => ({ ...r, isCurrent: r.id === id }));
      setResumes(updated);
      setResumeData(updated.find(r => r.id === id));
      if (selectedResume?.id === id) {
        setSelectedResume(updated.find(r => r.id === id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteResume = async (id: string) => {
    try {
      await fetch(`/api/resume?id=${id}`, { method: 'DELETE' });
      const updated = resumes.filter(r => r.id !== id);
      setResumes(updated);
      if (selectedResume?.id === id) {
        setSelectedResume(null);
      }
      const isCurrent = resumes.find(r => r.id === id)?.isCurrent;
      if (isCurrent) {
        fetchDashboardData();
      }
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
            <div className="flex items-center gap-3 pl-4">
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
                    {/* Guided Profile Prompt if No Active Resume */}
                    {!resumeData && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 border-2 border-dashed border-accent bg-accent/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-accent font-bold text-sm">
                            <AlertTriangle size={16} />
                            <span>Step 1: Upload or Select Candidate Resume</span>
                          </div>
                          <p className="text-xs text-fg-muted leading-relaxed max-w-xl">
                            To customize interview questions to your background and target competency gaps, an active resume profile is required. Upload your PDF in Assets or launch immediately with a pre-configured sample profile.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('resumes');
                              setIsUploading(true);
                            }}
                            className="prept-btn-primary text-xs font-bold whitespace-nowrap"
                          >
                            <Plus size={14} /> Upload Resume (PDF)
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateDemoResume}
                            className="px-3 py-2 bg-surface border border-accent text-accent hover:bg-accent-muted text-xs font-mono font-bold whitespace-nowrap"
                          >
                            ⚡ Use Sample Profile
                          </button>
                        </div>
                      </motion.div>
                    )}

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
                          <p className="text-sm text-fg-muted leading-relaxed">Customizable mix of technical and behavioral/HR topics. Live emotion & speaking pace indicators displayed.</p>
                        </button>
                      </div>
                    </div>
                    {/* Persona Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-fg">3. Interviewer Persona & Tone</p>
                        <span className="text-xs font-mono text-fg-muted">Adaptive AI Style</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {PERSONAS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setInterviewerPersona(p.id)}
                            className={`p-4 text-left border transition-all ${
                              interviewerPersona === p.id
                                ? 'bg-surface border-accent ring-1 ring-accent'
                                : 'bg-surface border-border hover:border-fg-muted'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm text-fg">{p.title}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 bg-accent-muted text-accent border border-accent/20">
                                {p.tag}
                              </span>
                            </div>
                            <p className="text-xs text-fg-muted leading-relaxed">{p.subtitle}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sliders (Only if Practice) */}
                    {mode === 'practice' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <p className="text-sm font-bold text-fg mb-3">4. Question Mix</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-warm rounded-none p-6 border border-border-soft">
                          <div>
                            <div className="flex justify-between text-xs font-mono mb-2"><span>Technical</span><span>{techSplit}%</span></div>
                            <input type="range" min="0" max="100" value={techSplit} onChange={(e) => handleSliderChange('tech', Number(e.target.value))} className="w-full accent-[var(--accent)] bg-border h-1.5 rounded-none appearance-none cursor-pointer" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-mono mb-2"><span>Behavioral</span><span>{hrSplit}%</span></div>
                            <input type="range" min="0" max="100" value={hrSplit} onChange={(e) => handleSliderChange('hr', Number(e.target.value))} className="w-full accent-[var(--accent)] bg-border h-1.5 rounded-none appearance-none cursor-pointer" />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Target Job Description & Gap Analysis */}
                    <div className="border border-border-soft bg-surface-warm/50 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target size={16} className="text-accent" />
                          <span className="text-sm font-bold text-fg">Target Job Description (Optional)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowJdInput(!showJdInput)}
                          className="text-xs font-mono text-accent hover:underline"
                        >
                          {showJdInput ? 'Collapse [-]' : '+ Paste Target JD'}
                        </button>
                      </div>

                      {showJdInput && (
                        <div className="mt-4 space-y-3">
                          <textarea
                            rows={4}
                            className="prept-input w-full text-xs font-mono resize-y"
                            placeholder="Paste full job description from LinkedIn, Greenhouse, or Lever to run automatic gap analysis and tailor questions..."
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                          />

                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-fg-muted font-mono">
                              {jobDescription.length > 0 ? `${jobDescription.length} characters` : 'Zero extra tokens until analyzed'}
                            </span>
                            <button
                              type="button"
                              onClick={handleAnalyzeJd}
                              disabled={isAnalyzingJd || jobDescription.trim().length < 20 || !resumeData}
                              className="px-3 py-1.5 bg-accent text-accent-on text-xs font-mono font-bold hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
                            >
                              <Sparkles size={13} />
                              {isAnalyzingJd ? 'Analyzing Gaps...' : 'Analyze Gaps vs Resume'}
                            </button>
                          </div>

                          {/* Gap Analysis HUD */}
                          {gapAnalysis && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-4 p-4 bg-surface border border-border space-y-3"
                            >
                              <div className="flex items-center justify-between border-b border-border-soft pb-2">
                                <span className="prept-label">Resume-to-JD Alignment</span>
                                <span className="px-2.5 py-0.5 bg-success-muted text-success text-xs font-mono font-bold">
                                  {gapAnalysis.matchScore}% Match
                                </span>
                              </div>

                              {gapAnalysis.matchingStrengths?.length > 0 && (
                                <div>
                                  <span className="text-[11px] font-mono text-success flex items-center gap-1 mb-1">
                                    <Check size={12} /> Matching Strengths
                                  </span>
                                  <ul className="space-y-1">
                                    {gapAnalysis.matchingStrengths.map((str, idx) => (
                                      <li key={idx} className="text-xs text-fg-muted pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-success">
                                        {str}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {gapAnalysis.missingGaps?.length > 0 && (
                                <div>
                                  <span className="text-[11px] font-mono text-warn flex items-center gap-1 mb-1">
                                    <AlertTriangle size={12} /> Target Interview Focus Areas (Gaps)
                                  </span>
                                  <ul className="space-y-1">
                                    {gapAnalysis.missingGaps.map((gap, idx) => (
                                      <li key={idx} className="text-xs text-fg-muted pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-warn">
                                        {gap}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleStart}
                      disabled={!resumeData || !(jobProfile || customRole)}
                      className="prept-btn-gradient w-full h-12 justify-center text-base mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={18} className="fill-current" />
                      {!resumeData
                        ? 'Upload or Select a Resume in Assets to Start'
                        : `Initiate ${mode === 'real' ? 'Interview' : 'Practice'} Room`}
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
                <div className="flex items-center gap-3">
                  <button onClick={handleCreateDemoResume} className="px-3 py-2 bg-surface border border-accent text-accent hover:bg-accent-muted text-xs font-mono font-bold">
                    ⚡ Add Sample Profile
                  </button>
                  <button onClick={() => setIsUploading(!isUploading)} className="prept-btn-secondary">
                    <Plus size={16} /> Upload New PDF
                  </button>
                </div>
              </div>

              {isUploading && (
                <div className="prept-card p-6 mb-8">
                  <ResumeUploader 
                    onUploadSuccess={() => {
                      fetchDashboardData();
                    }} 
                    onViewProfile={(data) => {
                      setSelectedResume(data);
                      setIsUploading(false);
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resumes.map((res) => {
                  const rating = res.rating || 0;
                  let ratingColor = 'text-fg-muted';
                  let ratingBg = 'bg-surface';
                  if (rating >= 7) { ratingColor = 'text-success'; ratingBg = 'bg-success-muted'; }
                  else if (rating >= 5) { ratingColor = 'text-warn'; ratingBg = 'bg-warn-muted'; }
                  else if (rating > 0) { ratingColor = 'text-danger'; ratingBg = 'bg-danger-muted'; }
                  
                  const skills = Array.isArray(res.skills) ? res.skills : typeof res.skills === 'string' ? JSON.parse(res.skills) : [];
                  const topSkills = skills.slice(0, 5);
                  const isCurrent = !!res.isCurrent;

                  return (
                    <div 
                      key={res.id} 
                      onClick={() => setSelectedResume(res)}
                      className={`prept-bento-card p-6 transition-all cursor-pointer relative flex flex-col justify-between ${
                        isCurrent
                          ? 'border-2 border-accent bg-accent/[0.04] shadow-lg ring-2 ring-accent/30'
                          : 'border border-border hover:border-fg-muted bg-surface'
                      }`}
                    >
                      <div>
                        {/* Status Header Badge */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`prept-icon-badge w-10 h-10 rounded-lg flex items-center justify-center ${isCurrent ? 'bg-accent text-accent-on' : ''}`}>
                              <FileText size={20} />
                            </div>
                            {isCurrent ? (
                              <span className="px-2.5 py-0.5 bg-accent text-accent-on text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                ACTIVE PROFILE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-surface-warm text-fg-muted text-[10px] font-mono border border-border uppercase">
                                STANDBY
                              </span>
                            )}
                          </div>

                          {rating > 0 && (
                            <span className={`px-2.5 py-1 text-xs font-mono font-bold ${ratingBg} ${ratingColor} border border-current/20`}>
                              ★ {rating}/10
                            </span>
                          )}
                        </div>
                        
                        <h3 className="font-bold text-lg mb-0.5 line-clamp-1 text-fg">{res.name}</h3>
                        <p className="text-[11px] text-fg-muted font-mono mb-4">
                          {isCurrent ? 'Active for all interview sessions' : `Updated ${new Date(res.updatedAt).toLocaleDateString()}`}
                        </p>
                        
                        {topSkills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {topSkills.map((sk: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-accent-muted text-accent text-[11px] font-mono border border-accent/20">
                                {sk}
                              </span>
                            ))}
                            {skills.length > 5 && (
                              <span className="px-2 py-0.5 bg-surface-warm text-fg-muted text-[10px] font-mono border border-border">
                                +{skills.length - 5}
                              </span>
                            )}
                          </div>
                        )}

                        {res.suggestions && (
                          <div className="text-xs text-fg-muted mb-4 bg-surface-warm rounded-lg p-3 border border-border-soft line-clamp-2">
                            {res.suggestions}
                          </div>
                        )}
                      </div>

                      {/* Action Footer */}
                      <div className="mt-4 pt-3 border-t border-border-soft">
                        {isCurrent ? (
                          <div className="w-full py-2 bg-accent-muted/60 text-accent border border-accent/30 text-center text-xs font-mono font-bold flex items-center justify-center gap-2">
                            <Check size={14} /> Profile In Use
                          </div>
                        ) : (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetCurrentResume(res.id);
                            }} 
                            className="w-full prept-btn-primary justify-center text-xs font-bold py-2.5"
                          >
                            Set as Active Profile
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div>
                <p className="prept-label mb-2">Review & Analytics</p>
                <h2 className="text-2xl font-extrabold tracking-tight">Candidate Performance History</h2>
              </div>

              {/* Skill Analytics Radar */}
              {history.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-fg-muted mb-3 flex items-center gap-1.5">
                    <Compass size={14} className="text-accent" /> Multidimensional Competency Radar
                  </p>
                  <SkillAnalyticsRadar history={history} />
                </div>
              )}
              
              <div className="space-y-4">
                <p className="prept-label">Session Transcripts</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {history.map((session) => (
                    <div 
                      key={session.id} 
                      onClick={() => router.push(`/report?id=${session.id}`)}
                      className="prept-bento-card p-6 cursor-pointer flex flex-col justify-between min-h-[200px]"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider ${session.mode === 'real' ? 'bg-success-muted text-success' : 'bg-accent-muted text-accent'}`}>
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
              </div>
            </motion.div>
          )}
          
        </AnimatePresence>
        
        <ResumeDetailModal
          resume={selectedResume}
          isOpen={!!selectedResume}
          onClose={() => setSelectedResume(null)}
          onDelete={handleDeleteResume}
          onSetActive={(id) => {
            handleSetCurrentResume(id);
            setSelectedResume(null);
          }}
        />
      </main>
    </div>
  );
}
