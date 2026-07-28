export type ColorThemeId = 'moss' | 'sand' | 'midnight';

export interface ColorTokens {
  paper: string;
  sheet: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  lineSoft: string;
  life: string;
  lifeDeep: string;
  lifeLight: string;
  lifeLine: string;
  sun: string;
  sunLight: string;
  onLife: string;
  onLifeMuted: string;
  onLifeLine: string;
  danger: string;
  dangerLight: string;
  dangerLine: string;
  backdrop: string;
  backdropStrong: string;
  overlay: string;
  toolbar: string;
  codeBackground: string;
  codeForeground: string;
}

export const colorThemes: Record<ColorThemeId, ColorTokens> = {
  moss: {
    paper: '#EEF0E8', sheet: '#F8F8F2', ink: '#20231F', inkSoft: '#586158', inkFaint: '#707970',
    line: 'rgba(32, 35, 31, 0.17)', lineSoft: 'rgba(32, 35, 31, 0.09)',
    life: '#1D6B49', lifeDeep: '#2F5E48', lifeLight: '#D8E8DC', lifeLine: 'rgba(29, 107, 73, 0.34)',
    sun: '#D4A84F', sunLight: '#F1E8CA', onLife: '#F4F6EF', onLifeMuted: 'rgba(244, 246, 239, 0.78)', onLifeLine: 'rgba(255, 255, 255, 0.22)',
    danger: '#9B493F', dangerLight: '#F8E7DE', dangerLine: 'rgba(155, 73, 63, 0.35)',
    backdrop: 'rgba(32, 35, 31, 0.28)', backdropStrong: 'rgba(32, 35, 31, 0.42)', overlay: 'rgba(32, 35, 31, 0.48)',
    toolbar: '#FCFCF8', codeBackground: '#252B27', codeForeground: '#EEF0E8',
  },
  sand: {
    paper: '#F3EDE2', sheet: '#FFF9EF', ink: '#302820', inkSoft: '#695B4E', inkFaint: '#8A7968',
    line: 'rgba(74, 55, 39, 0.18)', lineSoft: 'rgba(74, 55, 39, 0.09)',
    life: '#9A5A3A', lifeDeep: '#7E4933', lifeLight: '#EED9C8', lifeLine: 'rgba(154, 90, 58, 0.34)',
    sun: '#C58B2B', sunLight: '#F2E2B9', onLife: '#FFF9EF', onLifeMuted: 'rgba(255, 249, 239, 0.78)', onLifeLine: 'rgba(255, 249, 239, 0.24)',
    danger: '#A3473F', dangerLight: '#F6DDD5', dangerLine: 'rgba(163, 71, 63, 0.36)',
    backdrop: 'rgba(48, 40, 32, 0.28)', backdropStrong: 'rgba(48, 40, 32, 0.44)', overlay: 'rgba(48, 40, 32, 0.5)',
    toolbar: '#FFFDF7', codeBackground: '#332A23', codeForeground: '#FFF9EF',
  },
  midnight: {
    paper: '#111713', sheet: '#1A211C', ink: '#F0F2EB', inkSoft: '#BEC7BD', inkFaint: '#89948A',
    line: 'rgba(240, 242, 235, 0.16)', lineSoft: 'rgba(240, 242, 235, 0.09)',
    life: '#78C99A', lifeDeep: '#62B586', lifeLight: '#26392D', lifeLine: 'rgba(120, 201, 154, 0.36)',
    sun: '#E0B95E', sunLight: '#3D3521', onLife: '#102019', onLifeMuted: 'rgba(16, 32, 25, 0.72)', onLifeLine: 'rgba(16, 32, 25, 0.22)',
    danger: '#E0877C', dangerLight: '#3D2725', dangerLine: 'rgba(224, 135, 124, 0.42)',
    backdrop: 'rgba(0, 0, 0, 0.48)', backdropStrong: 'rgba(0, 0, 0, 0.66)', overlay: 'rgba(0, 0, 0, 0.58)',
    toolbar: '#222A24', codeBackground: '#090D0A', codeForeground: '#E7ECE5',
  },
};

let activeColorTheme: ColorThemeId = 'moss';

export function getActiveColorTheme(): ColorThemeId { return activeColorTheme; }
export function setActiveColorTheme(theme: ColorThemeId): void { activeColorTheme = theme; }

export const colors = new Proxy({} as ColorTokens, {
  get: (_target, property: keyof ColorTokens) => colorThemes[activeColorTheme][property],
});

export const spacing = { xs: 4, sm: 8, md: 12, lg: 22, xl: 30, xxl: 42 } as const;
export const radius = { sm: 4, md: 15, lg: 22, xl: 30 } as const;
export const typography = {
  display: 'serif',
  body: 'sans-serif',
  mono: 'monospace',
  size: {
    meta: 10,
    caption: 11,
    label: 12,
    body: 14,
    bodyLarge: 16,
    title: 20,
    display: 36,
  },
} as const;
