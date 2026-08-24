import { useEffect, useState } from 'react';
import { Image, type ImageResizeMode, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
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
  const player = useVideoPlayer(uri, (currentPlayer) => { currentPlayer.muted = true; });

  useEffect(() => {
    setFailed(false);
    const revealFirstFrame = (duration = player.duration) => {
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
      <View style={styles.videoPlay}><SymbolView name={{ android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' }} size={19} tintColor={colors.onLife} type="hierarchical" /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.lifeLight },
  image: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.codeBackground },
  videoPlay: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', paddingLeft: 2, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.72)', borderRadius: 21, backgroundColor: 'rgba(47, 116, 84, 0.9)' },
  unavailable: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sheet },
});
