import { StyleSheet } from 'react-native';
import type { TextStyle } from 'react-native';
import { colorThemes, colors, getActiveColorTheme, setActiveColorTheme, typography } from '@still-alive/tokens';
import type { ColorThemeId, ColorTokens } from '@still-alive/tokens';
import type { AppThemeId, NameStyleId } from '@still-alive/types';

export interface EditorTheme {
  colorScheme: 'light' | 'dark';
  paper: string;
  sheet: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  life: string;
  lifeDeep: string;
  lifeLight: string;
  lifeLine: string;
  sun: string;
  onLife: string;
  danger: string;
  dangerLight: string;
  dangerLine: string;
  overlay: string;
  codeBackground: string;
  codeForeground: string;
}

export const THEME_OPTIONS: ReadonlyArray<{ id: AppThemeId; label: string; hint: string; colors: ColorTokens }> = [
  { id: 'moss', label: '苔绿', hint: '安静自然', colors: colorThemes.moss },
  { id: 'sand', label: '暖砂', hint: '温暖柔和', colors: colorThemes.sand },
  { id: 'midnight', label: '夜墨', hint: '低光暗黑', colors: colorThemes.midnight },
];

export const NAME_STYLE_OPTIONS: ReadonlyArray<{ id: NameStyleId; label: string; hint: string; personalOnly?: boolean }> = [
  { id: 'fresh', label: '清简', hint: '清晰醒目' },
  { id: 'journal', label: '手记', hint: '温柔衬线' },
  { id: 'sunlit', label: '暖光', hint: '金色强调' },
  { id: 'colorful', label: '彩字', hint: '逐字变色', personalOnly: true },
  { id: 'iridescent', label: '炫彩', hint: '静态渐变', personalOnly: true },
];

export function applyColorTheme(theme: AppThemeId): void {
  setActiveColorTheme(theme);
}

export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: () => T): T {
  const cache = new Map<ColorThemeId, T>();
  return new Proxy({} as T, {
    get: (_target, property: string | symbol) => {
      const theme = getActiveColorTheme();
      let themed = cache.get(theme);
      if (!themed) {
        themed = StyleSheet.create(factory());
        cache.set(theme, themed);
      }
      return themed[property as keyof T];
    },
  });
}

export function nameTextStyle(style: NameStyleId): TextStyle {
  if (style === 'journal') return { color: colors.inkSoft, fontFamily: typography.display, fontStyle: 'italic', fontWeight: '600', letterSpacing: 0.25 };
  if (style === 'sunlit') return { color: colors.sun, fontFamily: typography.body, fontWeight: '800', letterSpacing: 0.65 };
  if (style === 'colorful') return { color: colors.life, fontFamily: typography.body, fontWeight: '800', letterSpacing: 0.5 };
  if (style === 'iridescent') return { color: colors.life, fontFamily: typography.body, fontWeight: '800', letterSpacing: 0.6 };
  return { color: colors.life, fontFamily: typography.body, fontWeight: '700' };
}

export function editorTheme(): EditorTheme {
  return {
    colorScheme: getActiveColorTheme() === 'midnight' ? 'dark' : 'light',
    paper: colors.paper,
    sheet: colors.sheet,
    ink: colors.ink,
    inkSoft: colors.inkSoft,
    inkFaint: colors.inkFaint,
    line: colors.line,
    life: colors.life,
    lifeDeep: colors.lifeDeep,
    lifeLight: colors.lifeLight,
    lifeLine: colors.lifeLine,
    sun: colors.sun,
    onLife: colors.onLife,
    danger: colors.danger,
    dangerLight: colors.dangerLight,
    dangerLine: colors.dangerLine,
    overlay: colors.overlay,
    codeBackground: colors.codeBackground,
    codeForeground: colors.codeForeground,
  };
}
