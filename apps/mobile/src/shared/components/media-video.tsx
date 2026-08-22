import { useEffect } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { StyleProp, ViewStyle } from 'react-native';

export function MediaVideo({ active = true, nativeControls = true, style, uri }: { active?: boolean; nativeControls?: boolean; style?: StyleProp<ViewStyle>; uri: string }) {
  const player = useVideoPlayer(uri);

  useEffect(() => {
    if (!active) player.pause();
  }, [active, player]);

  return <VideoView contentFit="contain" nativeControls={nativeControls} player={player} style={style} />;
}
