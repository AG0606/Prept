'use client';

import { motion } from 'framer-motion';
import { InteractiveCard } from './InteractiveCard';
import { Terminal, Waves, Activity } from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function BentoGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1180px] mx-auto w-full">
      {/* Main Wide Card - Live Code Execution */}
      <InteractiveCard delay={0.1} className="lg:col-span-2 prept-card border border-border group overflow-hidden">
        <div className="flex flex-col h-full min-h-[400px]">
          <div className="p-8 pb-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-surface-raised border border-border text-fg shadow-sm">
                <Terminal size={20} />
              </div>
              <h3 className="text-xl font-bold font-grotesk tracking-tight">Live Execution</h3>
            </div>
            <p className="text-fg-muted max-w-md">
              Write, compile, and run code directly in the browser. 
              Our Monaco editor supports multiple languages and hidden test cases.
            </p>
          </div>
          
          <div className="mt-8 flex-1 bg-[#0D0D12] border-t border-border/50 p-6 relative overflow-hidden">
            {/* Fake Code Editor */}
            <div className="font-mono text-sm leading-relaxed opacity-80 select-none group-hover:opacity-100 transition-opacity">
              <span className="text-[#c678dd]">function</span> <span className="text-[#61afef]">binarySearch</span>(arr, target) {'{'}
              <br/>
              &nbsp;&nbsp;<span className="text-[#c678dd]">let</span> left = <span className="text-[#d19a66]">0</span>;
              <br/>
              &nbsp;&nbsp;<span className="text-[#c678dd]">let</span> right = arr.length - <span className="text-[#d19a66]">1</span>;
              <br/>
              &nbsp;&nbsp;<span className="text-[#c678dd]">while</span> (left {'<='} right) {'{'}
              <br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#c678dd]">const</span> mid = Math.floor((left + right) / <span className="text-[#d19a66]">2</span>);
              <br/>
              &nbsp;&nbsp;&nbsp;&nbsp;...
              <br/>
              &nbsp;&nbsp;{'}'}
              <br/>
              {'}'}
            </div>
            
            {/* Typing cursor effect */}
            <motion.div 
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="absolute top-20 left-[180px] w-2 h-4 bg-[#61afef]"
            />
          </div>
        </div>
      </InteractiveCard>

      {/* Tall Card - Voice AI */}
      <InteractiveCard delay={0.2} className="prept-card border border-border group overflow-hidden">
        <div className="flex flex-col h-full min-h-[400px]">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-surface-raised border border-border text-fg shadow-sm">
                <Waves size={20} />
              </div>
              <h3 className="text-xl font-bold font-grotesk tracking-tight">Adaptive AI Voice</h3>
            </div>
            <p className="text-fg-muted">
              Real-time conversational interviews. The AI listens, interrupts, and asks deep architectural follow-ups.
            </p>
          </div>
          
          <div className="mt-auto p-8 flex justify-center items-center h-48 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-accent/5 to-transparent" />
            {/* Audio Visualizer Mock */}
            <div className="flex items-end gap-1.5 h-16 z-10">
              {[40, 70, 45, 90, 60, 30, 80, 50, 65, 35].map((h, i) => (
                <motion.div
                  key={i}
                  animate={{ height: [`${h/2}%`, `${h}%`, `${h/2}%`] }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 1.5,
                    delay: i * 0.1,
                    ease: "easeInOut" 
                  }}
                  className="w-2 rounded-full bg-accent"
                />
              ))}
            </div>
          </div>
        </div>
      </InteractiveCard>

      {/* Wide Card Bottom - Analytics */}
      <InteractiveCard delay={0.3} className="lg:col-span-3 prept-card border border-border group overflow-hidden bg-surface-warm/30">
        <div className="flex flex-col md:flex-row items-center">
          <div className="p-8 md:p-12 md:w-1/2">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-surface border border-border text-fg shadow-sm">
                <Activity size={20} />
              </div>
              <h3 className="text-xl font-bold font-grotesk tracking-tight">Deep Analytics</h3>
            </div>
            <p className="text-fg-muted max-w-md">
              Every pause, every "um", every line of code is tracked. Receive dimensional scores on your confidence, communication, and technical depth.
            </p>
          </div>
          <div className="p-8 md:p-12 md:w-1/2 w-full flex justify-end">
            <div className="w-full max-w-sm grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface border border-border">
                <p className="text-xs text-fg-subtle uppercase tracking-wider mb-1">Communication</p>
                <p className="text-3xl font-mono font-bold text-success">92</p>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-border">
                <p className="text-xs text-fg-subtle uppercase tracking-wider mb-1">Technical</p>
                <p className="text-3xl font-mono font-bold text-accent">85</p>
              </div>
            </div>
          </div>
        </div>
      </InteractiveCard>
    </div>
  );
}
