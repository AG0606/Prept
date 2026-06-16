'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export function DesignPhilosophy() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  });

  // Parallax values for abstract shapes
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const rotate1 = useTransform(scrollYProgress, [0, 1], [0, 45]);
  const rotate2 = useTransform(scrollYProgress, [0, 1], [0, -45]);
  
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.6, 1], [0, 1, 1, 0]);

  return (
    <section 
      ref={containerRef}
      className="relative py-32 md:py-48 overflow-hidden bg-bg border-t border-border"
    >
      {/* Background Abstract Geometric Shapes */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
        <motion.div 
          style={{ y: y1, rotate: rotate1 }}
          className="absolute w-[400px] h-[400px] rounded-[100px] border border-accent/20 bg-gradient-to-tr from-accent/5 to-transparent blur-xl"
        />
        <motion.div 
          style={{ y: y2, rotate: rotate2 }}
          className="absolute w-[300px] h-[300px] rounded-full border border-secondary/20 bg-gradient-to-bl from-secondary/5 to-transparent blur-2xl ml-64"
        />
      </div>

      <div className="max-w-[1180px] mx-auto px-6 relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="prept-label mb-6 text-accent">Design Philosophy</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] text-fg max-w-[800px] mx-auto">
            Built for focus. <br />
            <span className="text-fg-muted">Engineered for success.</span>
          </h2>
        </motion.div>

        <motion.p
          style={{ opacity }}
          className="mt-10 text-lg md:text-xl text-fg-muted max-w-[600px] leading-relaxed mx-auto"
        >
          We believe that true preparation requires zero friction. Prept strips away the noise, leaving you with an intelligent, immersive environment to hone your skills.
        </motion.p>
        
        {/* Interactive Glass Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 w-full max-w-[800px] h-[300px] prept-glass rounded-2xl border border-border shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-lg transform rotate-12 group-hover:rotate-0 group-hover:scale-110 transition-all duration-500 ease-out">
                <span className="w-6 h-6 rounded-md bg-accent" />
             </div>
          </div>
          <div className="absolute bottom-6 left-6 right-6 text-left">
             <p className="font-mono text-xs text-fg-muted uppercase tracking-widest mb-1">Precision Interface</p>
             <p className="text-sm font-medium text-fg">Where every pixel serves your performance.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
