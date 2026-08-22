import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { MusicTrack } from '@still-alive/types';
import { useAppState } from './state/app-state';
import { useMusicPlayer } from '../features/music/music-player-state';

export function useSharedMusicPlayback(): (track: MusicTrack) => Promise<void> {
  const router = useRouter();
  const player = useMusicPlayer();
  const { media, musicTracks } = useAppState();
  return useCallback(async (track: MusicTrack) => {
    const mediaIds = new Set(media.map((item) => item.id));
    const queueTrackIds = musicTracks.filter((item) => mediaIds.has(item.mediaId)).map((item) => item.id);
    if (!queueTrackIds.includes(track.id)) return;
    await player.playTrack(track.id, queueTrackIds, 'all');
    router.push('/music-player' as never);
  }, [media, musicTracks, player, router]);
}
