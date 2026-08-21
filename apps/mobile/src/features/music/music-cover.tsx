import { useEffect, useMemo, useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { Asset } from 'expo-asset';
import type { Media } from '@still-alive/types';

export const DEFAULT_MUSIC_COVER = require('../../../assets/music-default-cover.png');
let defaultCoverUri: string | null = null;
let defaultCoverPromise: Promise<string> | null = null;

export function MusicCover({ media, size, style }: { media?: Media | null; size: number; style?: StyleProp<ImageStyle> }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [media?.localPath]);
  const source = useMemo(() => media?.localPath && !failed ? { uri: media.localPath } : DEFAULT_MUSIC_COVER, [failed, media?.localPath]);
  return <Image accessibilityIgnoresInvertColors onError={() => setFailed(true)} resizeMode="cover" source={source} style={[{ width: size, height: size, borderRadius: Math.min(12, size * 0.18) }, style]} />;
}

export async function resolveMusicCoverUri(media?: Media | null): Promise<string> {
  if (media?.localPath) return media.localPath;
  if (defaultCoverUri) return defaultCoverUri;
  if (!defaultCoverPromise) {
    defaultCoverPromise = Asset.fromModule(DEFAULT_MUSIC_COVER).downloadAsync().then((asset) => asset.localUri || asset.uri);
  }
  defaultCoverUri = await defaultCoverPromise;
  return defaultCoverUri;
}
