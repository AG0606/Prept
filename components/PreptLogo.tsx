import React from 'react';
import Image from 'next/image';

interface PreptLogoProps {
  size?: number;
  className?: string;
}

export function PreptLogo({ size = 28, className = '' }: PreptLogoProps) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-md ${className}`} style={{ width: size, height: size }}>
      <Image
        src="/logo.png"
        alt="Prept Logo"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}

export function PreptWordmark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 relative ${className}`}>
      <PreptLogo size={28} />
      <div className="relative">
        <span className="font-bold text-lg tracking-tight tracking-[0.2em] uppercase">Prept</span>
        {/* Animated bouncing dot from design assets */}
        <div 
          className="absolute w-1.5 h-1.5 bg-accent top-[-4px] left-0"
          style={{ animation: 'bounceOnLetters 4s infinite cubic-bezier(0.45, 0, 0.55, 1)' }}
        />
      </div>
    </div>
  );
}
