'use client';

import clsx from 'clsx';

interface ProgressRingProps {
  /** Progresso de 0 a 100 */
  value: number;
  /** Tamanho em pixels */
  size?: number;
  /** Espessura do anel em pixels */
  strokeWidth?: number;
  /** Cor do progresso (CSS class) */
  color?: string;
  /** Mostrar label central */
  showLabel?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 6,
  color = 'stroke-cyan-500',
  showLabel = true,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference;

  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/5"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={clsx(color, 'transition-all duration-700 ease-out')}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-sm font-bold text-slate-200">
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
}
