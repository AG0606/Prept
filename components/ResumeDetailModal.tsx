import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Briefcase, GraduationCap, Code, Star, Trash2, Check } from 'lucide-react';

interface ResumeDetailModalProps {
  resume: any;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onSetActive?: (id: string) => void;
}

export function ResumeDetailModal({
  resume,
  isOpen,
  onClose,
  onDelete,
  onSetActive,
}: ResumeDetailModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!resume) return null;

  const rating = resume.rating || 0;
  let ratingColor = 'text-fg-muted';
  if (rating >= 7) ratingColor = 'text-success';
  else if (rating >= 5) ratingColor = 'text-warn';
  else if (rating > 0) ratingColor = 'text-danger';

  // Safe JSON parsing helpers
  const safeParse = (val: any) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  const skills = safeParse(resume.skills);
  const experience = safeParse(resume.experience);
  const projects = safeParse(resume.projects);
  const education = safeParse(resume.education);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-bg border border-border overflow-hidden prept-panel shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-border bg-surface sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight mb-2 text-fg">{resume.name || 'Resume'}</h2>
                <div className="flex items-center gap-4 text-sm font-mono text-fg-muted">
                  <span>Uploaded: {new Date(resume.updatedAt || Date.now()).toLocaleDateString()}</span>
                  {resume.isCurrent && (
                    <span className="bg-accent-muted text-accent px-2 py-0.5 border border-accent/20 text-xs flex items-center gap-1">
                      <Check size={12} /> ACTIVE
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xs uppercase font-bold text-fg-muted tracking-wider mb-1">AI Rating</div>
                  <div className={`text-3xl font-mono font-bold ${ratingColor}`}>
                    {rating ? `${rating}/10` : 'N/A'}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-fg-muted hover:text-fg hover:bg-surface-warm border border-transparent hover:border-border transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* AI Feedback */}
              {resume.suggestions && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={16} className="text-accent" />
                    <h3 className="prept-label">AI Feedback</h3>
                  </div>
                  <div className="bg-surface-warm border border-border p-4 text-sm leading-relaxed text-fg">
                    {resume.suggestions}
                  </div>
                </section>
              )}

              {/* Skills */}
              {skills.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Code size={16} className="text-accent" />
                    <h3 className="prept-label">Skills</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill: string, i: number) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-accent-muted text-accent text-xs font-mono border border-accent/20"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Experience */}
              {experience.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase size={16} className="text-accent" />
                    <h3 className="prept-label">Experience</h3>
                  </div>
                  <div className="space-y-4">
                    {experience.map((exp: any, i: number) => (
                      <div key={i} className="prept-card p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-fg">{exp.company || 'Unknown Company'}</h4>
                            <p className="text-sm text-accent">{exp.role || exp.title || 'Role'}</p>
                          </div>
                          <span className="text-xs font-mono text-fg-muted">{exp.duration || exp.date || ''}</span>
                        </div>
                        {exp.description && (
                          <p className="text-sm text-fg-muted mt-2 whitespace-pre-line">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Projects */}
              {projects.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Code size={16} className="text-accent" />
                    <h3 className="prept-label">Projects</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.map((proj: any, i: number) => (
                      <div key={i} className="prept-card p-4">
                        <h4 className="font-bold text-fg mb-1">{proj.name || 'Project Name'}</h4>
                        <p className="text-xs text-fg-muted mb-3 line-clamp-3">{proj.description}</p>
                        {proj.techStack && proj.techStack.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {proj.techStack.map((tech: string, j: number) => (
                              <span key={j} className="px-2 py-0.5 bg-surface-warm text-fg-muted text-[10px] font-mono border border-border">
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Education */}
              {education.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <GraduationCap size={16} className="text-accent" />
                    <h3 className="prept-label">Education</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {education.map((edu: any, i: number) => (
                      <div key={i} className="prept-card p-4 border-l-2 border-l-accent border-t-border border-r-border border-b-border">
                        <h4 className="font-bold text-fg text-sm">{edu.institution || 'Institution'}</h4>
                        <p className="text-xs text-fg-muted">{edu.degree || 'Degree'}</p>
                        <p className="text-[10px] font-mono text-fg-subtle mt-1">{edu.year || edu.date || ''}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Footer / Actions */}
            <div className="p-4 border-t border-border bg-surface flex justify-between items-center sticky bottom-0">
              {onDelete ? (
                <button
                  onClick={() => onDelete(resume.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-danger border border-danger hover:bg-danger-muted transition-colors"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              ) : <div />}
              
              <div className="flex gap-3">
                <button onClick={onClose} className="prept-btn-secondary">
                  Close
                </button>
                {!resume.isCurrent && onSetActive && (
                  <button onClick={() => onSetActive(resume.id)} className="prept-btn-primary">
                    Set as Active
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
