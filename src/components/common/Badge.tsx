import React from 'react';
import { BedStatus, RentPaymentStatus } from '../../types';

interface BadgeProps {
  label: string;
  dotColor?: string;
  variant?: 'emerald' | 'amber' | 'rose' | 'brand' | 'slate';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  dotColor,
  variant = 'slate',
  size = 'md',
  icon,
  className = '',
}) => {
  const dotColorClasses = {
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
    rose: 'bg-rose-600',
    brand: 'bg-brand-600',
    slate: 'bg-slate-400',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const activeDot = dotColor || dotColorClasses[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white font-medium text-slate-700 ${sizeStyles[size]} ${className}`}
    >
      {icon ? (
        icon
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeDot}`} aria-hidden="true" />
      )}
      <span className="leading-none">{label}</span>
    </span>
  );
};

export const BedStatusBadge: React.FC<{ status: BedStatus; className?: string }> = ({ status, className }) => {
  switch (status) {
    case 'vacant':
      return <Badge label="Vacant" variant="emerald" className={className} />;
    case 'occupied':
      return <Badge label="Occupied" variant="brand" className={className} />;
    case 'notice':
      return <Badge label="Notice" variant="amber" className={className} />;
    case 'maintenance':
      return <Badge label="Maintenance" variant="rose" className={className} />;
  }
};

export const RentStatusBadge: React.FC<{
  status: RentPaymentStatus;
  balanceRemaining?: number;
  className?: string;
}> = ({ status, balanceRemaining, className }) => {
  switch (status) {
    case 'paid':
      return <Badge label="Paid in full" variant="emerald" className={className} />;
    case 'due_soon':
      return <Badge label="Due soon" variant="amber" className={className} />;
    case 'overdue':
      return <Badge label="Overdue" variant="rose" className={className} />;
    case 'partially_paid':
      return (
        <Badge
          label={balanceRemaining ? `Partially paid (₹${balanceRemaining.toLocaleString('en-IN')} due)` : 'Partially paid'}
          variant="amber"
          className={className}
        />
      );
  }
};
