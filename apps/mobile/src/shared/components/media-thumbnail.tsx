import { useEffect, useState } from 'react';
import { Image, type ImageResizeMode, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
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
      {item && isVideo ? <VideoThumbnail resizeMode={resizeMode} uri={item.localPath} /> : null}
      {!item || (!isVideo && failed) ? <View style={styles.unavailable}><SymbolView name={{ android: 'broken_image', ios: 'photo.badge.exclamationmark', web: 'broken_image' }} size={23} tintColor={colors.inkFaint} type="hierarchical" /></View> : null}
    </View>
  );
}

function VideoThumbnail({ resizeMode, uri }: { resizeMode: ImageResizeMode; uri: string }) {
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState(0);
  const player = useVideoPlayer(uri, (currentPlayer) => { currentPlayer.muted = true; });

  useEffect(() => {
    setFailed(false);
    setDuration(0);
    const revealFirstFrame = (duration = player.duration) => {
      if (duration > 0) setDuration(duration);
      if (duration > 0 && player.currentTime === 0) player.currentTime = Math.min(0.1, duration / 2);
    };
    if (player.status === 'readyToPlay') revealFirstFrame();
    const loadSubscription = player.addListener('sourceLoad', ({ duration }) => revealFirstFrame(duration));
    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') setFailed(true);
      else if (status === 'readyToPlay') {
        setFailed(false);
        revealFirstFrame();
      }
    });
    return () => {
      loadSubscription.remove();
      statusSubscription.remove();
    };
  }, [player, uri]);

  if (failed) return <View style={styles.unavailable}><SymbolView name={{ android: 'broken_image', ios: 'photo.badge.exclamationmark', web: 'broken_image' }} size={23} tintColor={colors.inkFaint} type="hierarchical" /></View>;

  return (
    <View pointerEvents="none" style={styles.video}>
      <VideoView contentFit={resizeMode === 'contain' ? 'contain' : 'cover'} nativeControls={false} player={player} style={StyleSheet.absoluteFill} surfaceType="textureView" useExoShutter={false} />
      <View style={styles.videoPlay}><SymbolView name={{ android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' }} size={14} tintColor="rgba(255, 255, 255, 0.92)" type="hierarchical" /></View>
      {duration > 0 ? <Text style={styles.duration}>{formatDuration(duration)}</Text> : null}
    </View>
  );
}

function formatDuration(value: number): string {
  const seconds = Math.max(0, Math.round(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.lifeLight },
  image: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.codeBackground },
  videoPlay: { position: 'absolute', left: 10, bottom: 10, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingLeft: 1, borderRadius: 14, backgroundColor: 'rgba(12, 16, 14, 0.68)' },
  duration: { position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 3, color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(0,0,0,0.64)', fontFamily: 'monospace', fontSize: 10 },
  unavailable: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sheet },
});
