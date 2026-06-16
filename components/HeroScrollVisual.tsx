'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export function HeroScrollVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const rotateX = useTransform(scrollYProgress, [0, 1], [15, -15]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div ref={containerRef} className="relative w-full max-w-[1000px] mx-auto mt-20 perspective-[2000px]">
      <motion.div 
        style={{ rotateX, y }}
        className="w-full relative prept-panel overflow-hidden shadow-2xl rounded-2xl border border-border/50 bg-surface/50 backdrop-blur-xl"
      >
        {/* Mockup title bar */}
        <div className="grid grid-cols-[190px_1fr_auto] items-center gap-4 p-4 border-b border-border/40 bg-surface-raised/40">
          <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-danger/50 border border-danger/20" />
            <span className="w-3 h-3 rounded-full bg-warn/50 border border-warn/20" />
            <span className="w-3 h-3 rounded-full bg-success/50 border border-success/20" />
          </div>
          <div className="font-mono text-xs text-fg-muted/60 text-center tracking-widest">
            PREPT_WORKSPACE_01
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-accent font-mono text-[10px] uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Live
          </div>
        </div>

        {/* Mockup body */}
        <div className="grid grid-cols-[250px_1fr] min-h-[450px]">
          {/* Sidebar */}
          <div className="border-r border-border/40 p-4 bg-surface/30 space-y-4">
            <div className="w-full h-32 rounded-xl bg-surface-raised border border-border/50 relative overflow-hidden flex items-center justify-center group">
               <div className="absolute inset-0 bg-accent/5" />
               <div className="w-12 h-12 rounded-full border-2 border-accent/30 flex items-center justify-center bg-surface shadow-lg relative z-10">
                 <div className="w-2 h-2 rounded-full bg-accent" />
               </div>
               <div className="absolute bottom-3 left-3 flex gap-1">
                 <div className="w-1 h-3 bg-accent/40 rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
                 <div className="w-1 h-4 bg-accent/60 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.2s]" />
                 <div className="w-1 h-2 bg-accent/40 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.4s]" />
               </div>
            </div>
            <div className="space-y-2">
              <div className="h-2 w-1/2 bg-fg-muted/20 rounded-full" />
              <div className="h-2 w-3/4 bg-fg-muted/10 rounded-full" />
            </div>
          </div>
          
          {/* Main workspace */}
          <div className="p-6 bg-bg/50 relative overflow-hidden flex flex-col">
            <div className="flex-1 rounded-xl bg-surface-raised border border-border/50 p-6 shadow-inner font-mono text-sm leading-relaxed text-fg-subtle">
              <span className="text-tertiary">function</span> <span className="text-secondary">evaluateCandidate</span>(answers) {'{'}
              <br />
              &nbsp;&nbsp;<span className="text-tertiary">const</span> signals = extractSignals(answers);
              <br />
              &nbsp;&nbsp;<span className="text-tertiary">if</span> (signals.depth === <span className="text-accent">'shallow'</span>) {'{'}
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;generateFollowUpQuestion();
              <br />
              &nbsp;&nbsp;{'}'}
              <br />
              &nbsp;&nbsp;<span className="text-tertiary">return</span> signals.score;
              <br />
              {'}'}
            </div>
            
            <div className="mt-4 p-4 rounded-xl border border-border/50 bg-surface/40 flex items-start gap-4">
               <div className="w-8 h-8 rounded-full bg-accent/20 flex-shrink-0 flex items-center justify-center">
                 <div className="w-4 h-4 bg-accent rounded-full" />
               </div>
               <div className="space-y-2 flex-1 pt-1">
                 <div className="h-2 w-1/4 bg-fg-muted/30 rounded-full" />
                 <div className="h-2 w-full bg-fg-muted/10 rounded-full" />
                 <div className="h-2 w-5/6 bg-fg-muted/10 rounded-full" />
               </div>
            </div>
          </div>
        </div>
        
        {/* Glow behind */}
        <div className="absolute -inset-[100px] bg-accent/10 blur-[100px] -z-10 pointer-events-none rounded-full" />
      </motion.div>
    </div>
  );
}
