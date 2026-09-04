import { Text, View } from 'react-native';
import { colors, radius } from '@still-alive/tokens';
import type { MusicQuality } from '@still-alive/types';
import { createThemedStyles } from '../../shared/theme/app-theme';

export const QUALITY_OPTIONS: Array<{ value: MusicQuality | null; label: string }> = [
  { value: null, label: '未标记' },
  { value: 'HQ', label: 'HQ' },
  { value: 'SQ', label: 'SQ' },
];

export function MusicQualityBadge({ quality }: { quality: MusicQuality | null | undefined }) {
  if (!quality) return null;
  const isSq = quality === 'SQ';
  return <View accessibilityLabel={`音质 ${quality}`} style={[styles.badge, isSq ? styles.sqBadge : styles.hqBadge]}><Text style={[styles.text, isSq ? styles.sqText : styles.hqText]}>{quality}</Text></View>;
}

const styles = createThemedStyles(() => ({
  badge: { minWidth: 23, height: 15, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 0.7, borderRadius: 8 },
  sqBadge: { borderColor: colors.lifeLine, backgroundColor: colors.lifeLight },
  hqBadge: { borderColor: colors.sun, backgroundColor: colors.sunLight },
  text: { fontSize: 7.5, fontWeight: '800', letterSpacing: 0.55, lineHeight: 10 },
  sqText: { color: colors.life },
  hqText: { color: colors.sun },
}));
