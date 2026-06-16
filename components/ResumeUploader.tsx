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
}

export function ResumeUploader({ onUploadSuccess }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
        
        // Save to DB
        await fetch('/api/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resumeData),
        });

        setResumeData(resumeData);
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
    [setResumeData, jobProfile]
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

  return (
    <div
      id="resume-uploader"
      className={`relative w-full max-w-xl mx-auto flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-150 ${
        isDragging
          ? 'border-foreground bg-panel-bg'
          : success
          ? 'border-neon-green/50 bg-neon-green/5'
          : 'border-panel-border bg-panel-bg/40 hover:bg-panel-header hover:border-zinc-400 dark:hover:border-zinc-750'
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

      <div className="mb-4 text-text-muted">
        {isProcessing ? (
          <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        ) : success ? (
          <div className="w-10 h-10 rounded-full bg-neon-green/10 flex items-center justify-center text-neon-green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-panel-bg border border-panel-border flex items-center justify-center text-text-secondary">
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
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">Analyzing Resume Profile...</h3>
            <p className="text-[10px] text-text-muted">Extracting skills, experience & projects with AI</p>
          </>
        ) : success ? (
          <>
            <h3 className="text-sm font-bold text-neon-green uppercase tracking-wider mb-1 flex items-center justify-center gap-1">Upload Completed <Check size={14} /></h3>
            <p className="text-[10px] text-text-secondary truncate max-w-md">{fileName}</p>
          </>
        ) : (
          <>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">Drop your resume here</h3>
            <p className="text-[10px] text-text-muted">or click to browse · PDF only · Max 10MB</p>
          </>
        )}
      </div>

      {error && <p className="mt-4 text-xs font-mono font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">{error}</p>}
    </div>
  );
}
