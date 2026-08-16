import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface PreptLogoProps {
  size?: number;
  className?: string;
  noLink?: boolean;
}

export function PreptLogo({ size = 28, className = '', noLink = false }: PreptLogoProps) {
  const inner = (
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

  if (noLink) {
    return inner;
  }

  return (
    <Link href="/" className="flex items-center gap-2 no-underline">
      {inner}
    </Link>
  );
}

export function PreptWordmark({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 no-underline ${className}`}>
      <PreptLogo size={28} noLink />
      <span className="font-bold text-lg tracking-tight tracking-[0.2em] uppercase">Prept</span>
    </Link>
  );
}
