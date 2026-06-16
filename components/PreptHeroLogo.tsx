'use client';

import { motion } from 'framer-motion';
import { PreptLogo } from './PreptLogo';

export function PreptHeroLogo() {
  return (
    <div className="relative w-full h-[400px] flex items-center justify-center p-12 bg-surface">
      {/* Blueprint Grid Overlay */}
      <div className="absolute inset-0 bg-blueprint pointer-events-none" />

      {/* Brutalist framing box */}
      <motion.div 
        className="absolute inset-0 border border-border"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      />
      
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-accent" />
      <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-accent" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-accent" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-accent" />
      
      {/* Viewport Label */}
      <div className="absolute top-3 left-3 font-mono text-[10px] text-fg-subtle">VIEWPORT_01</div>
      
      {/* Animated Image Logo + Wordmark */}
      <motion.div 
        className="relative z-10 flex flex-col items-center gap-6"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
      >
        {/* We use the actual image logo here, scaled up, with a slight float animation */}
        <div className="bg-bg p-4 border border-border shadow-[4px_4px_0px_rgba(0,0,0,1)]">
           <PreptLogo size={80} />
        </div>
        <span className="font-bold text-4xl tracking-[0.2em] uppercase bg-bg px-4 py-1 border border-border">Prept</span>
      </motion.div>

      {/* Grid crosshairs */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <div className="w-full h-[1px] bg-border/50 absolute" />
        <div className="h-full w-[1px] bg-border/50 absolute" />
      </motion.div>
    </div>
  );
}
