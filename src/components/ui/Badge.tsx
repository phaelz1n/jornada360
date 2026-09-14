'use client';

import clsx from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'cyan';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  error: 'bg-red-500/15 text-red-400 border-red-500/25',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  neutral: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
  cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
  neutral: 'bg-slate-400',
  cyan: 'bg-cyan-400',
};

export function Badge({ children, variant = 'neutral', dot = false, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full animate-pulse', dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
