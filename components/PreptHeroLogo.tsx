'use client';

import { motion } from 'framer-motion';

export function PreptHeroLogo() {
  const dotVariants = {
    animate: {
      x: [0, 60, 120, 180, 240], // Bouncing across letters
      y: [0, -40, 0, -40, 0], // The arc
      transition: {
        x: { duration: 2, ease: "linear" as const, repeat: Infinity },
        y: { duration: 0.5, ease: "easeOut" as const, repeat: Infinity, repeatType: "mirror" as const }
      }
    }
  };

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
      
      {/* Animated Text Logo */}
      <div className="relative flex items-end h-[100px] z-10">
        {/* The bouncing dot */}
        <motion.div
          variants={dotVariants}
          animate="animate"
          className="absolute -left-2 bottom-20 w-4 h-4 rounded-full bg-accent"
        />

        {/* The literal text "Prept" in bold Brutalist font */}
        <svg viewBox="0 0 300 100" className="w-full h-full max-w-[300px]">
          <text 
            x="0" 
            y="80" 
            fontFamily="var(--font-inter)" 
            fontWeight="900" 
            fontSize="80" 
            fill="var(--fg)"
            letterSpacing="-0.05em"
          >
            Prept
          </text>
        </svg>
      </div>

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
