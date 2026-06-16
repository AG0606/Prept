'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PreptWordmark } from '@/components/PreptLogo';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { TetrisAnimation } from '@/components/TetrisAnimation';
import { ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-sm font-medium tracking-widest uppercase">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bg text-fg selection:bg-accent selection:text-white">
      {/* Brutalist Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-bg border-b border-border">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <PreptWordmark />
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a href="#features" className="hover:text-accent transition-colors">Platform</a>
              <a href="#workflow" className="hover:text-accent transition-colors">How it works</a>
              <a href="#pricing" className="hover:text-accent transition-colors">Pricing</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="text-sm font-medium hover:text-accent transition-colors hidden md:block"
            >
              Sign In
            </button>
            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="prept-btn-primary"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Centered Brutalist Hero Section */}
      <section className="pt-40 md:pt-56 pb-32 max-w-[1440px] mx-auto px-6 lg:px-12 flex flex-col items-center text-center min-h-[85vh] justify-center">
        <div className="inline-flex items-center gap-3 border border-border px-4 py-2 mb-12 bg-surface text-sm font-medium">
          <span className="w-2 h-2 bg-accent rounded-none" />
          V2 Architecture Live
        </div>

        <h1 className="text-6xl md:text-8xl lg:text-[100px] font-medium tracking-tight leading-[0.95] mb-8 max-w-5xl mx-auto uppercase">
          AI Interview<br />Simulation.
        </h1>

        <p className="text-xl md:text-2xl text-fg-muted max-w-3xl mx-auto mb-16 font-mono leading-relaxed">
          Train for your next career move in a high-fidelity, adaptive environment. Real-time feedback, live code execution, and deep performance analytics built for top engineers.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="prept-btn-gradient px-8 py-4 text-lg"
          >
            Start Practicing Free
            <ArrowRight size={20} className="ml-2" />
          </button>
          <button className="prept-btn-secondary px-8 py-4 text-lg">
            View Documentation
          </button>
        </div>
      </section>

      {/* Structural Learning (Brutalist Tetris) */}
      <section className="border-y border-border grid grid-cols-1 md:grid-cols-2">
        <div className="p-12 lg:p-24 border-b md:border-b-0 md:border-r border-border flex flex-col justify-center">
          <h2 className="text-4xl md:text-5xl lg:text-[64px] font-medium tracking-tight mb-8 uppercase">
            Structural<br />Learning.
          </h2>
          <p className="text-lg text-fg-muted max-w-[400px] font-mono leading-relaxed">
            Our platform builds your technical foundation block by block, ensuring an interlocking mastery of complex systems.
          </p>
        </div>
        <div className="bg-surface p-12 lg:p-24 flex items-center justify-center min-h-[400px]">
          <TetrisAnimation />
        </div>
      </section>

      {/* Blueprint Grid */}
      <section id="features" className="max-w-[1440px] mx-auto pt-32 pb-32 px-6 lg:px-12 flex flex-col items-start">
        <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-16 w-full text-left">
          A strict technical toolkit.
        </h2>
        <BlueprintGrid />
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="border-y border-border bg-surface">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-32">
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-20">
            System Workflow
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 border border-border divide-y md:divide-y-0 md:divide-x divide-border">
            {[
              { step: '01', title: 'Parse Resume', desc: 'System ingests your background to tailor architecture questions.' },
              { step: '02', title: 'Initialize', desc: 'Select target company and difficulty constraints.' },
              { step: '03', title: 'Execute', desc: 'Live coding interface with active AI conversational interrupts.' },
              { step: '04', title: 'Telemetry', desc: 'Post-session breakdown of communication and technical depth.' }
            ].map((item, i) => (
              <div key={i} className="p-8 md:p-10 bg-bg flex flex-col hover:bg-surface-warm transition-colors">
                <div className="text-xs font-medium tracking-widest text-fg-subtle mb-6">STEP {item.step}</div>
                <h4 className="text-xl font-medium mb-4">{item.title}</h4>
                <p className="text-fg-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-40 max-w-[1440px] mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
        <h2 className="text-5xl md:text-7xl font-medium tracking-tight mb-12">
          Secure the offer.
        </h2>
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="prept-btn-primary px-12 py-5 text-lg"
        >
          Initialize Session
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-bg py-12">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <PreptWordmark />
          <div className="flex gap-8 text-sm font-medium text-fg-muted">
            <a href="#" className="hover:text-fg transition-colors">Privacy</a>
            <a href="#" className="hover:text-fg transition-colors">Terms</a>
            <a href="#" className="hover:text-fg transition-colors">Telemetry</a>
          </div>
          <p className="text-sm text-fg-subtle">
            © {new Date().getFullYear()} Prept Systems.
          </p>
        </div>
      </footer>
    </main>
  );
}
