'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { PreptWordmark } from '@/components/PreptLogo';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-fg">
      <div className="max-w-md w-full prept-panel p-8 text-center space-y-6 shadow-none">
        <div className="mx-auto w-16 h-16 rounded-full bg-danger-muted flex items-center justify-center text-danger mb-4">
          <AlertTriangle size={32} />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight">Something went wrong</h2>
          <p className="text-fg-muted text-sm leading-relaxed">
            We encountered an unexpected error. Your progress might not be saved.
          </p>
        </div>

        <div className="p-4 bg-surface-warm border border-border rounded-none text-left overflow-auto max-h-32 text-xs font-mono text-fg-subtle">
          {error.message || 'Unknown error occurred'}
        </div>

        <div className="flex flex-col gap-3 pt-4 border-t border-border">
          <button
            onClick={() => reset()}
            className="w-full prept-btn-primary justify-center h-12"
          >
            <RefreshCcw size={16} />
            Try Again
          </button>
          
          <Link href="/dashboard" className="w-full prept-btn-secondary justify-center h-12">
            Return to Dashboard
          </Link>
        </div>
      </div>
      
      <div className="mt-8 opacity-50">
        <PreptWordmark />
      </div>
    </div>
  );
}
