export const typography = {
  fontFamily: {
    sans: '-apple-system, "Noto Sans SC", "Helvetica Neue", sans-serif',
    serif: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", monospace',
  },
  fontSize: {
    xs: 12,
    sm: 13,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    reading: 1.8,
  },
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;
