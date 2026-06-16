'use client';

import { Terminal, Waves, Activity, FileText, UserCheck, LayoutTemplate } from 'lucide-react';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';

export function BlueprintGrid() {
  return (
    <div className="w-full border-y border-border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
      
      {/* Cell 1 */}
      <div className="flex flex-col p-8 md:p-12 min-h-[500px]">
        <div className="flex items-center gap-3 mb-6">
          <Terminal size={24} />
          <h3 className="text-xl font-medium tracking-tight">Live Execution</h3>
        </div>
        <p className="text-fg-muted text-lg mb-12">
          Write, compile, and run code directly in the browser. 
          Our Monaco editor supports multiple languages and hidden test cases.
        </p>
        
        <div className="mt-auto border border-border bg-bg p-6 relative">
          {/* Brutalist Editor Mock */}
          <div className="font-mono text-sm leading-relaxed opacity-60">
            <span>function</span> <span>evaluate</span>(arr, target) {'{'}
            <br/>
            &nbsp;&nbsp;<span>let</span> left = 0;
            <br/>
            &nbsp;&nbsp;<span>let</span> right = arr.length - 1;
            <br/>
            &nbsp;&nbsp;<span>while</span> (left {'<='} right) {'{'}
            <br/>
            &nbsp;&nbsp;&nbsp;&nbsp;<span>const</span> mid = Math.floor((left + right) / 2);
            <br/>
            &nbsp;&nbsp;&nbsp;&nbsp;...
            <br/>
            &nbsp;&nbsp;{'}'}
            <br/>
            {'}'}
          </div>
        </div>
      </div>

      {/* Cell 2 */}
      <div className="flex flex-col p-8 md:p-12 min-h-[500px]">
        <div className="flex items-center gap-3 mb-6">
          <Waves size={24} />
          <h3 className="text-xl font-medium tracking-tight">Adaptive AI Voice</h3>
        </div>
        <p className="text-fg-muted text-lg mb-12">
          Real-time conversational interviews. The AI listens, interrupts, and asks deep architectural follow-ups.
        </p>
        
        <div className="mt-auto border border-border bg-bg h-48 flex items-center justify-center p-6 relative">
           {/* Animated Soundwave Graphic */}
           <AudioWaveVisualizer barCount={12} maxHeight={60} />
        </div>
      </div>

      {/* Cell 3 */}
      <div className="flex flex-col p-8 md:p-12 min-h-[500px]">
        <div className="flex items-center gap-3 mb-6">
          <Activity size={24} />
          <h3 className="text-xl font-medium tracking-tight">Deep Analytics</h3>
        </div>
        <p className="text-fg-muted text-lg mb-12">
          Every pause, every "um", every line of code is tracked. Receive dimensional scores on your confidence, communication, and technical depth.
        </p>
        
        <div className="mt-auto flex items-end gap-5">
          <div>
            <span className="text-[64px] leading-none font-medium text-accent">85</span>
            <span className="font-mono text-xs uppercase tracking-widest text-fg-muted ml-2">/ 100</span>
          </div>
          {/* Status Matrix Mini */}
          <div className="grid grid-cols-4 gap-1 mb-2">
            {[0.8, 0.2, 0.5, 0.9].map((opacity, i) => (
              <div key={i} className="w-1.5 h-1.5 bg-accent" style={{ opacity }} />
            ))}
          </div>
        </div>
      </div>

      {/* Cell 4 */}
      <div className="flex flex-col p-8 md:p-12 min-h-[500px]">
        <div className="flex items-center gap-3 mb-6">
          <FileText size={24} />
          <h3 className="text-xl font-medium tracking-tight">Resume Intelligence</h3>
        </div>
        <p className="text-fg-muted text-lg mb-12">
          Upload your PDF. Our agent parses your actual background to synthesize hyper-specific, relevant technical scenarios.
        </p>
        
        <div className="mt-auto border border-border bg-bg p-6 font-mono text-sm opacity-60">
          <div>[INFO] Extracting entity: AWS_LAMBDA</div>
          <div>[INFO] Found skill: DISTRIBUTED_SYSTEMS</div>
          <div className="text-accent">[ACTION] Compiling targeted scenario...</div>
        </div>
      </div>

      {/* Cell 5 */}
      <div className="flex flex-col p-8 md:p-12 min-h-[500px]">
        <div className="flex items-center gap-3 mb-6">
          <UserCheck size={24} />
          <h3 className="text-xl font-medium tracking-tight">Behavioral Mastery</h3>
        </div>
        <p className="text-fg-muted text-lg mb-12">
          Train on leadership principles using the STAR framework. The AI pushes you to quantify your impact.
        </p>
        
        <div className="mt-auto border border-border bg-surface-warm p-6">
          <div className="flex gap-2 mb-2">
            <span className="bg-accent text-white px-2 py-0.5 text-xs">S</span>
            <span className="bg-accent text-white px-2 py-0.5 text-xs">T</span>
            <span className="bg-border text-fg-muted px-2 py-0.5 text-xs">A</span>
            <span className="bg-border text-fg-muted px-2 py-0.5 text-xs">R</span>
          </div>
          <p className="text-xs text-fg-muted font-mono">Missing Action & Result dimensions. Please elaborate.</p>
        </div>
      </div>

      {/* Cell 6 */}
      <div className="flex flex-col p-8 md:p-12 min-h-[500px]">
        <div className="flex items-center gap-3 mb-6">
          <LayoutTemplate size={24} />
          <h3 className="text-xl font-medium tracking-tight">System Design</h3>
        </div>
        <p className="text-fg-muted text-lg mb-12">
          Verbalize highly-scalable architectures. The AI comprehends load balancing, sharding, and caching strategies.
        </p>
        
        <div className="mt-auto border border-border bg-bg p-6 flex flex-col gap-2">
          <div className="w-full h-8 border border-border flex items-center justify-center text-xs text-fg-muted">API GATEWAY</div>
          <div className="flex gap-2">
            <div className="flex-1 h-12 border border-border flex items-center justify-center text-xs text-fg-muted">SERVICE A</div>
            <div className="flex-1 h-12 border border-border flex items-center justify-center text-xs text-fg-muted">SERVICE B</div>
          </div>
        </div>
      </div>

    </div>
  );
}
