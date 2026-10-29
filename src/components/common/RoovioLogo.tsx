import React from 'react';

interface RoovioLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark-only';
  theme?: 'on-light' | 'on-dark' | 'card';
  className?: string;
  showSubtitle?: boolean;
  subtitle?: string;
}

export const RoovioLogo: React.FC<RoovioLogoProps> = ({
  size = 'md',
  variant = 'full',
  theme = 'on-light',
  className = '',
  showSubtitle = false,
  subtitle = 'PG & Property Operations',
}) => {
  // Height definitions for proportional scaling without distortion
  const heightClasses = {
    xs: 'h-5',
    sm: 'h-6',
    md: 'h-7 sm:h-8',
    lg: 'h-9 sm:h-10',
    xl: 'h-12 sm:h-14',
  }[size];

  const markSizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  }[size];

  // Theme styling for high-contrast presentation
  // Logo has deep navy (#061942) and vibrant electric blue (#1859E2)
  const containerTheme = {
    'on-light': 'bg-transparent',
    'on-dark': 'bg-white/95 px-2.5 py-1 rounded-xl shadow-xs border border-white/20',
    'card': 'bg-white px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs inline-flex items-center',
  }[theme];

  if (variant === 'mark-only') {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        <img
          src="/roovio-mark.png"
          alt="ROOVIO Mark"
          className={`${markSizeClasses} object-contain`}
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className={`inline-flex items-center gap-2 ${containerTheme}`}>
        <img
          src="/roovio-logo-tight.png"
          alt="ROOVIO"
          className={`${heightClasses} w-auto object-contain shrink-0`}
          loading="eager"
        />
      </div>
      {showSubtitle && (
        <span className="text-[11px] font-medium text-slate-500 tracking-wide mt-1">
          {subtitle}
        </span>
      )}
    </div>
  );
};

