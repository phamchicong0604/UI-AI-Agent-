import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-1">
      {label && <label className="block text-slate-300 font-semibold text-xs">{label}</label>}
      <input
        className={`w-full bg-slate-950 border ${
          error ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'
        } rounded-xl px-3.5 py-2 text-white placeholder-slate-500 text-xs focus:outline-none transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-slate-400">{helperText}</p>}
    </div>
  );
};
