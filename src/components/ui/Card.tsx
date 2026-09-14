'use client';

import { type ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({
  children,
  className,
  glass = true,
  padding = 'md',
  hover = false,
}: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border transition-all duration-300',
        glass
          ? 'bg-white/5 backdrop-blur-xl border-white/10'
          : 'bg-slate-800/80 border-slate-700/50',
        hover && 'hover:bg-white/8 hover:border-white/15 hover:shadow-lg hover:shadow-cyan-500/5',
        paddingStyles[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
