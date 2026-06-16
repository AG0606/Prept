'use client';

import { motion } from 'framer-motion';

export function InfiniteMarquee() {
  const logos = [
    "Google", "Meta", "Amazon", "Microsoft", "Apple", "Netflix",
    "Stripe", "Vercel", "OpenAI", "Anthropic", "Airbnb", "Uber"
  ];

  return (
    <div className="w-full overflow-hidden flex flex-col items-center justify-center py-10 md:py-16 bg-bg border-y border-border opacity-80">
      <p className="text-xs font-mono uppercase tracking-widest text-fg-muted mb-8 text-center">
        Trusted by engineers at
      </p>
      
      <div className="relative w-full max-w-[1440px] mx-auto flex overflow-hidden mask-edges">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, ease: "linear", duration: 40 }}
          className="flex whitespace-nowrap gap-12 md:gap-24 pl-12 md:pl-24"
        >
          {/* Double the array for seamless infinite scroll */}
          {[...logos, ...logos].map((logo, i) => (
            <div 
              key={i} 
              className="text-xl md:text-2xl font-extrabold text-fg-muted/40 hover:text-fg-muted transition-colors duration-300 select-none"
            >
              {logo}
            </div>
          ))}
        </motion.div>
      </div>

      <style jsx>{`
        .mask-edges {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
      `}</style>
    </div>
  );
}
