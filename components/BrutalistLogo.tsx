'use client';

import { motion } from 'framer-motion';

export function BrutalistLogo() {
  const draw = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: (i: number) => {
      const delay = 1 + i * 0.2;
      return {
        pathLength: 1,
        opacity: 1,
        transition: {
          pathLength: { delay, type: "spring" as const, duration: 1.5, bounce: 0 },
          opacity: { delay, duration: 0.01 }
        }
      };
    }
  };

  return (
    <div className="relative w-[400px] h-[400px]">
      <motion.svg
        width="400"
        height="400"
        viewBox="0 0 400 400"
        initial="hidden"
        animate="visible"
        className="w-full h-full stroke-accent overflow-visible"
        style={{ strokeWidth: 1.5, strokeLinecap: 'square' }}
      >
        {/* Background Grid */}
        <g className="stroke-border/40" style={{ strokeWidth: 1 }}>
          {[...Array(10)].map((_, i) => (
            <motion.line key={`h-${i}`} x1="0" y1={i * 40} x2="400" y2={i * 40} custom={i * 0.1} variants={draw} />
          ))}
          {[...Array(10)].map((_, i) => (
            <motion.line key={`v-${i}`} x1={i * 40} y1="0" x2={i * 40} y2="400" custom={i * 0.1 + 0.5} variants={draw} />
          ))}
        </g>

        {/* Diagonal Axis */}
        <motion.line x1="0" y1="0" x2="400" y2="400" className="stroke-accent/50" strokeDasharray="4 4" custom={1.5} variants={draw} />
        
        {/* Main Structure 1 (Rectangle) */}
        <motion.rect x="80" y="80" width="240" height="240" fill="none" className="stroke-accent" custom={2} variants={draw} />
        
        {/* Main Structure 2 (Circle) */}
        <motion.circle cx="200" cy="200" r="160" fill="none" className="stroke-fg" custom={2.5} variants={draw} />
        
        {/* Inner Structure */}
        <motion.rect x="120" y="120" width="160" height="160" fill="none" className="stroke-fg-muted" custom={3} variants={draw} />
        <motion.circle cx="200" cy="200" r="80" fill="none" className="stroke-accent" strokeDasharray="8 8" custom={3.5} variants={draw} />

        {/* Intersection Dots */}
        <motion.circle cx="80" cy="80" r="4" fill="var(--bg)" className="stroke-accent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} />
        <motion.circle cx="320" cy="80" r="4" fill="var(--bg)" className="stroke-accent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} />
        <motion.circle cx="80" cy="320" r="4" fill="var(--bg)" className="stroke-accent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} />
        <motion.circle cx="320" cy="320" r="4" fill="var(--bg)" className="stroke-accent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} />

        {/* Center Pulsing Core */}
        <motion.circle cx="200" cy="200" r="4" fill="var(--accent)" stroke="none" 
          initial={{ scale: 0 }} 
          animate={{ scale: [1, 1.5, 1] }} 
          transition={{ delay: 4, duration: 2, repeat: Infinity }} 
        />
        
        {/* Structural Labels */}
        <motion.text x="85" y="75" className="fill-accent font-mono text-[10px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4 }}>
          [N: 400.00]
        </motion.text>
        <motion.text x="325" y="315" className="fill-accent font-mono text-[10px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.2 }}>
          [S: 1.000]
        </motion.text>
      </motion.svg>
    </div>
  );
}
