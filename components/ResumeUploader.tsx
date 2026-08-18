'use client';
// ════════════════════════════════════════════════════════════
// Resume Uploader — Drag & Drop PDF Upload Component
// ════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import { parseResumePDF } from '@/lib/resumeParser';
import { useInterviewStore } from '@/store/interviewStore';
import { Check } from 'lucide-react';

interface ResumeUploaderProps {
  onUploadSuccess?: () => void;
  onViewProfile?: (data: any) => void;
}

export function ResumeUploader({ onUploadSuccess, onViewProfile }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadedData, setUploadedData] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setResumeData = useInterviewStore((s) => s.setResumeData);
  const jobProfile = useInterviewStore((s) => s.jobProfile);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be under 10MB');
        return;
      }

      setError(null);
      setFileName(file.name);
      setIsProcessing(true);

      try {
        const resumeData = await parseResumePDF(file, jobProfile || undefined);
        
        let finalResumeData: any = { ...resumeData };

        // Save to DB if user is authenticated
        try {
          const dbRes = await fetch('/api/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resumeData),
          });

          if (dbRes.ok) {
            const savedDbRecord = await dbRes.json();
            if (savedDbRecord && savedDbRecord.id) {
              finalResumeData = {
                ...finalResumeData,
                id: savedDbRecord.id,
                name: savedDbRecord.name || finalResumeData.name,
              };
            }
          }
        } catch (dbErr) {
          console.warn('Could not save resume to DB directly (will sync upon sign-in):', dbErr);
        }

        // Save to local storage as fallback/guest persistence
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('prept_active_resume', JSON.stringify(finalResumeData));
          } catch (e) {
            // Ignore quota errors
          }
        }

        setResumeData(finalResumeData);
        setUploadedData(finalResumeData);
        setSuccess(true);
        if (onUploadSuccess) onUploadSuccess();
      } catch (err) {
        setError(
          `Failed to parse resume: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [setResumeData, jobProfile, onUploadSuccess]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (success && uploadedData) {
    const rating = uploadedData.rating || 0;
    let ratingColor = 'text-fg-muted';
    let ratingBg = 'bg-surface';
    if (rating >= 7) { ratingColor = 'text-success'; ratingBg = 'bg-success-muted'; }
    else if (rating >= 5) { ratingColor = 'text-warn'; ratingBg = 'bg-warn-muted'; }
    else if (rating > 0) { ratingColor = 'text-danger'; ratingBg = 'bg-danger-muted'; }

    const safeParse = (val: any) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return []; }
      }
      return [];
    };

    const skills = safeParse(uploadedData.skills);
    const topSkills = skills.slice(0, 8);
    
    // Get first sentence or line of suggestions
    const suggestionLines = uploadedData.suggestions ? uploadedData.suggestions.split(/[.\n]/).filter((l: string) => l.trim().length > 0) : [];
    const firstSuggestion = suggestionLines.length > 0 ? suggestionLines[0].trim() + '.' : '';

    return (
      <div className="w-full max-w-xl mx-auto p-6 border border-success bg-success-muted/30">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-success uppercase tracking-wider mb-1 flex items-center gap-1"><Check size={14} /> Upload Completed</h3>
            <p className="text-xs text-fg-muted truncate max-w-xs">{fileName}</p>
          </div>
          <div className={`px-3 py-1 text-lg font-mono font-bold border border-current ${ratingColor} ${ratingBg}`}>
            {rating}/10
          </div>
        </div>

        {topSkills.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-bold text-fg uppercase tracking-wider mb-2">Extracted Skills</div>
            <div className="flex flex-wrap gap-1.5">
              {topSkills.map((skill: string, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-surface text-fg-muted text-[10px] font-mono border border-border">
                  {skill}
                </span>
              ))}
              {skills.length > 8 && (
                <span className="px-2 py-0.5 bg-surface text-fg-muted text-[10px] font-mono border border-border">
                  +{skills.length - 8}
                </span>
              )}
            </div>
          </div>
        )}

        {firstSuggestion && (
          <div className="mb-6 p-3 bg-surface border border-border text-sm text-fg">
            <span className="font-bold text-accent mr-2">AI Note:</span>
            {firstSuggestion}
          </div>
        )}

        <button 
          onClick={() => onViewProfile?.(uploadedData)}
          className="prept-btn-secondary w-full"
        >
          View Full Profile
        </button>
      </div>
    );
  }

  return (
    <div
      id="resume-uploader"
      className={`relative w-full max-w-xl mx-auto flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-none cursor-pointer transition-all duration-150 ${
        isDragging
          ? 'border-fg bg-surface'
          : 'border-border bg-surface hover:bg-surface-warm hover:border-fg-muted'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={onFileSelect}
        className="hidden"
        id="resume-file-input"
      />

      <div className="mb-4 text-fg-muted">
        {isProcessing ? (
          <div className="w-8 h-8 border-2 border-fg border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className="w-10 h-10 rounded-none bg-surface border border-border flex items-center justify-center text-fg-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
        )}
      </div>

      <div className="text-center font-mono select-none">
        {isProcessing ? (
          <>
            <h3 className="text-sm font-bold text-fg uppercase tracking-wider mb-1">Analyzing Resume Profile...</h3>
            <p className="text-[10px] text-fg-muted">Extracting skills, experience & projects with AI</p>
          </>
        ) : (
          <>
            <h3 className="text-sm font-bold text-fg uppercase tracking-wider mb-1">Drop your resume here</h3>
            <p className="text-[10px] text-fg-muted">or click to browse · PDF only · Max 10MB</p>
          </>
        )}
      </div>

      {error && <p className="mt-4 text-xs font-mono font-bold text-danger bg-danger-muted border border-danger/20 px-3 py-1.5 rounded-none">{error}</p>}
    </div>
  );
}
