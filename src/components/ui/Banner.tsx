'use client';

import clsx from 'clsx';

type BannerVariant = 'info' | 'warning' | 'error' | 'offline' | 'success';

interface BannerProps {
  children: React.ReactNode;
  variant?: BannerVariant;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const variantStyles: Record<BannerVariant, string> = {
  info: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  error: 'bg-red-500/10 border-red-500/20 text-red-300',
  offline: 'bg-violet-500/10 border-violet-500/20 text-violet-300',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
};

const icons: Record<BannerVariant, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  offline: '📡',
  success: '✅',
};

export function Banner({
  children,
  variant = 'info',
  dismissible = false,
  onDismiss,
  className,
}: BannerProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-2.5 text-sm border rounded-xl',
        variantStyles[variant],
        className
      )}
    >
      <span className="flex-shrink-0">{icons[variant]}</span>
      <span className="flex-1">{children}</span>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
