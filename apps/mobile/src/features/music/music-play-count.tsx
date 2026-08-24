import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../../shared/theme/app-theme';

export function MusicPlayCount({ count }: { count: number }) {
  return (
    <View accessibilityLabel={`播放 ${count} 次`} style={styles.root}>
      <SymbolView name={{ android: 'headphones', ios: 'headphones', web: 'headphones' }} size={11} tintColor={colors.inkFaint} type="hierarchical" />
      <Text style={styles.count}>{count}</Text>
    </View>
  );
}

const styles = createThemedStyles(() => ({
  root: { marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 3 },
  count: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
}));
