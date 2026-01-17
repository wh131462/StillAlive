/**
 * Color palette matching the design mockup
 * Based on Tailwind's slate, emerald, and rose scales
 */
export const colors = {
  // Slate scale (neutral grays)
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  // Primary (emerald green - life/survival theme)
  primaryLight: '#d1fae5',
  primary: '#10b981',
  primaryDark: '#059669',

  // Accent (rose red - heartbeat theme)
  accentLight: '#ffe4e6',
  accent: '#f43f5e',
  accentDark: '#e11d48',

  // Functional colors
  success: '#22c55e',
  successLight: '#dcfce7',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',

  // Amber (for birthdays)
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber500: '#f59e0b',
  amber600: '#d97706',

  // Sky (for hints)
  sky50: '#f0f9ff',
  sky100: '#e0f2fe',
  sky700: '#0369a1',

  // Base colors
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // Semantic aliases
  background: '#f8fafc',
  surface: '#f1f5f9',
  cardBackground: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  textDisabled: '#cbd5e1',
} as const;

export type ColorKey = keyof typeof colors;
