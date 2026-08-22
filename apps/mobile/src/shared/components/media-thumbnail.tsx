import { useEffect, useState } from 'react';
import { Image, type ImageResizeMode, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { Media } from '@still-alive/types';
import { colors } from '@still-alive/tokens';

export function MediaThumbnail({ accessibilityLabel, item, resizeMode = 'cover', style }: { accessibilityLabel?: string; item: Media | null | undefined; resizeMode?: ImageResizeMode; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item?.id, item?.localPath]);

  const isVideo = item?.mimeType.startsWith('video/');
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.frame, style]}>
      {item && !isVideo && !failed ? <Image onError={() => setFailed(true)} resizeMode={resizeMode} source={{ uri: item.localPath }} style={styles.image} /> : null}
      {isVideo ? <View style={styles.video}><SymbolView name={{ android: 'play_circle', ios: 'play.circle.fill', web: 'play_circle' }} size={30} tintColor="#FFFFFF" type="hierarchical" /><Text style={styles.videoLabel}>视频</Text></View> : null}
      {!item || (!isVideo && failed) ? <View style={styles.unavailable}><SymbolView name={{ android: 'broken_image', ios: 'photo.badge.exclamationmark', web: 'broken_image' }} size={23} tintColor={colors.inkFaint} type="hierarchical" /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.lifeLight },
  image: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#252927' },
  videoLabel: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  unavailable: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sheet },
});
