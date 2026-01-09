import React from 'react';
import { cn } from '../index';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  className,
  label,
  error,
  id,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent',
          'disabled:opacity-50 disabled:bg-slate-50',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  className,
  label,
  error,
  id,
  ...props
}: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent',
          'disabled:opacity-50 disabled:bg-slate-50',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
