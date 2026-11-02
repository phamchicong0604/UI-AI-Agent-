import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'amber' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all select-none disabled:opacity-50 disabled:pointer-events-none';

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-xs font-semibold gap-2 shadow-sm',
    lg: 'px-5 py-2.5 text-sm font-semibold gap-2.5 shadow-md'
  };

  const variantStyles = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25',
    secondary: 'bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25',
    amber: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25',
    outline: 'bg-transparent border border-slate-700 hover:bg-slate-800/80 text-slate-300 hover:text-white',
    ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white'
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};
