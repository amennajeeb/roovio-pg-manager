import React from 'react';
import { LucideIcon, ArrowRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  subValueColor?: 'emerald' | 'rose' | 'amber' | 'slate';
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  progress?: {
    current: number;
    total: number;
    percent: number;
    barColor?: string;
  };
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  subValueColor = 'slate',
  icon: Icon,
  iconBg = 'bg-slate-50',
  iconColor = 'text-slate-600',
  progress,
  actionText,
  onAction,
  className = '',
}) => {
  const subColorClasses = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
    slate: 'text-slate-500',
  };

  const isClickable = Boolean(onAction);

  return (
    <div
      onClick={onAction}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onAction?.();
        }
      }}
      className={`bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all ${
        isClickable ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div>
        {/* Header: Label + Icon */}
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-2.5">
          <span
            className="text-xs sm:text-sm font-semibold text-slate-600 truncate"
            title={label}
          >
            {label}
          </span>
          <div
            className={`p-1.5 sm:p-2 rounded-lg border border-slate-100 ${iconBg} ${iconColor} shrink-0`}
          >
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[1.75]" />
          </div>
        </div>

        {/* Headline Value */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl lg:text-[28px] font-extrabold tracking-tight text-slate-900 tabular-nums leading-none">
            {value}
          </span>
        </div>

        {/* Secondary Description */}
        {subValue && (
          <p
            className={`text-[11px] sm:text-xs mt-1.5 sm:mt-2 font-medium line-clamp-1 sm:line-clamp-2 ${subColorClasses[subValueColor]}`}
            title={subValue}
          >
            {subValue}
          </p>
        )}

        {/* Progress Bar (Compact & responsive) */}
        {progress && (
          <div className="mt-2.5 sm:mt-3">
            <div className="flex justify-between text-[10px] sm:text-xs text-slate-500 mb-1 font-medium">
              <span>{progress.current} of {progress.total} occupied</span>
              <span className="tabular-nums font-bold text-slate-700">{progress.percent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.barColor || 'bg-brand-600'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      {actionText && onAction && (
        <div className="mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1">
            {actionText}
            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      )}
    </div>
  );
};
