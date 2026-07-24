export const colors = {
  paper: '#EEF0E8',
  sheet: '#F8F8F2',
  ink: '#20231F',
  inkSoft: '#656B62',
  inkFaint: '#979D93',
  line: 'rgba(32, 35, 31, 0.13)',
  life: '#1D6B49',
  lifeLight: '#D8E8DC',
  sun: '#D4A84F',
  sunLight: '#F1E8CA',
  onLife: '#F4F6EF',
  onLifeMuted: 'rgba(244, 246, 239, 0.68)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 22, xl: 30, xxl: 42 } as const;
export const radius = { sm: 4, md: 15, lg: 22, xl: 30 } as const;
export const typography = {
  display: 'serif',
  body: 'sans-serif',
  mono: 'monospace',
} as const;
