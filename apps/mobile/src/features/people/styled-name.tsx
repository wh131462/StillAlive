import MaskedView from '@react-native-masked-view/masked-view';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { getActiveColorTheme, typography } from '@still-alive/tokens';
import type { NameStyleId } from '@still-alive/types';
import { nameTextStyle } from '../../shared/theme/app-theme';

interface StyledNameProps {
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  value: string;
  variant: NameStyleId;
}

const NAME_COLORS = {
  moss: ['#1D6B49', '#B37C1F', '#9B493F', '#446B8A'],
  sand: ['#9A5A3A', '#B97A18', '#A3473F', '#527264'],
  midnight: ['#78C99A', '#E0B95E', '#E0877C', '#8FB7E8'],
} as const;

const IRIDESCENT_COLORS = {
  moss: createGradientBands(NAME_COLORS.moss),
  sand: createGradientBands(NAME_COLORS.sand),
  midnight: createGradientBands(NAME_COLORS.midnight),
} as const;

export function StyledName({ numberOfLines, style, value, variant }: StyledNameProps) {
  const theme = getActiveColorTheme();
  const palette = NAME_COLORS[theme];

  if (variant === 'iridescent') {
    const textStyle = [style, nameTextStyle(variant)];
    return <View accessibilityLabel={value} accessibilityRole="text" accessible style={styles.iridescentName}>
      <Text accessible={false} numberOfLines={numberOfLines} style={[textStyle, styles.measureText]}>{value}</Text>
      <MaskedView accessible={false} maskElement={<Text accessible={false} numberOfLines={numberOfLines} style={[textStyle, styles.maskText]}>{value}</Text>} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.gradient}>{IRIDESCENT_COLORS[theme].map((color, index) => <View key={`${color}_${index}`} style={[styles.gradientBand, { backgroundColor: color }]} />)}</View>
      </MaskedView>
    </View>;
  }

  if (variant === 'petal') {
    return <Text accessibilityLabel={value} numberOfLines={numberOfLines} style={[style, nameTextStyle(variant)]}>
      {[...value].map((character, index) => <Text key={`${character}_${index}`} style={{ color: palette[(index * 2) % palette.length], fontFamily: typography.display, fontStyle: index % 2 ? 'italic' : 'normal' }}>{character}</Text>)}
    </Text>;
  }

  return (
    <Text accessibilityLabel={value} numberOfLines={numberOfLines} style={[style, nameTextStyle(variant)]}>
      {variant === 'colorful'
        ? [...value].map((character, index) => <Text key={`${character}_${index}`} style={{ color: palette[index % palette.length] }}>{character}</Text>)
        : value}
    </Text>
  );
}

function createGradientBands(palette: readonly string[], count = 24): string[] {
  return Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1) * (palette.length - 1);
    const startIndex = Math.floor(position);
    const endIndex = Math.min(startIndex + 1, palette.length - 1);
    return mixHexColors(palette[startIndex], palette[endIndex], position - startIndex);
  });
}

function mixHexColors(start: string, end: string, amount: number): string {
  const startValue = Number.parseInt(start.slice(1), 16);
  const endValue = Number.parseInt(end.slice(1), 16);
  const channel = (shift: number) => Math.round(((startValue >> shift) & 255) * (1 - amount) + ((endValue >> shift) & 255) * amount).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

const styles = StyleSheet.create({
  iridescentName: { width: '100%', maxWidth: '100%' },
  measureText: { opacity: 0 },
  maskText: { color: '#000000' },
  gradient: { flex: 1, flexDirection: 'row' },
  gradientBand: { flex: 1 },
});
