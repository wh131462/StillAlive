import React from 'react';
import { cn } from '../index';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        {
          'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-500': variant === 'primary',
          'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-300': variant === 'secondary',
          'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 focus:ring-slate-300': variant === 'outline',
          'text-slate-900 hover:bg-slate-100 focus:ring-slate-300': variant === 'ghost',
        },
        {
          'h-8 px-3 text-sm': size === 'sm',
          'h-10 px-4 text-base': size === 'md',
          'h-12 px-6 text-lg': size === 'lg',
        },
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
