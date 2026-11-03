import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' | 'cyan';
  size?: 'xs' | 'sm';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'xs',
  icon,
  className = ''
}) => {
  const sizeStyles = {
    xs: 'text-[10px] font-bold px-2 py-0.5 rounded-full',
    sm: 'text-xs font-semibold px-2.5 py-0.5 rounded-full'
  };

  const variantStyles = {
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    info: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
    purple: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    neutral: 'bg-slate-800 text-slate-300 border border-slate-700'
  };

  return (
    <span className={`inline-flex items-center gap-1 shrink-0 whitespace-nowrap ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {icon}
      {children}
    </span>
  );
};
