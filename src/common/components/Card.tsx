import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false
}) => {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm transition-all ${
        hoverable ? 'hover:border-slate-700/80 cursor-pointer hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
