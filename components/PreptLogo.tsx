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
    <div className={`flex items-center gap-2.5 ${className}`}>
      <PreptLogo size={28} />
      <span className="font-bold text-lg tracking-tight tracking-[0.2em] uppercase">Prept</span>
    </div>
  );
}
