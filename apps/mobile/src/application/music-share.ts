import type { MusicTrack } from '@still-alive/types';

export interface MusicShare {
  album: string | null;
  artist: string | null;
  title: string;
  trackId: string;
  version: 1;
}

const MUSIC_SHARE_PATTERN = /<!--\s*stillalive-music-share:([^\s]+)\s*-->/g;

export function createMusicShare(track: MusicTrack): MusicShare {
  return {
    album: track.album?.trim() || null,
    artist: track.artist?.trim() || null,
    title: track.title.trim() || '未命名音乐',
    trackId: track.id,
    version: 1,
  };
}

export function extractMusicShares(markdown: string): MusicShare[] {
  return [...markdown.matchAll(MUSIC_SHARE_PATTERN)]
    .map((match) => decodeMusicShare(match[1]))
    .filter((item): item is MusicShare => Boolean(item));
}

export function withoutMusicShares(markdown: string): string {
  return markdown.replace(MUSIC_SHARE_PATTERN, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function withMusicShare(markdown: string, share: MusicShare | null): string {
  const body = withoutMusicShares(markdown);
  if (!share) return body;
  const marker = `<!-- stillalive-music-share:${encodeURIComponent(JSON.stringify(share))} -->`;
  return body ? `${marker}\n\n${body}` : marker;
}

function decodeMusicShare(value: string): MusicShare | null {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!parsed || typeof parsed !== 'object') return null;
    const item = parsed as Partial<MusicShare>;
    if (item.version !== 1 || typeof item.trackId !== 'string' || !item.trackId || typeof item.title !== 'string' || !item.title) return null;
    return {
      album: typeof item.album === 'string' && item.album ? item.album : null,
      artist: typeof item.artist === 'string' && item.artist ? item.artist : null,
      title: item.title,
      trackId: item.trackId,
      version: 1,
    };
  } catch {
    return null;
  }
}
