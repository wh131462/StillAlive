import type { MusicCollectionEntry, MusicTrack } from '@still-alive/types';

export function orderMusicTracksByCollectionEntries(tracks: MusicTrack[], entries: MusicCollectionEntry[]): MusicTrack[] {
  const tracksById = new Map(tracks.map((track) => [track.id, track]));
  const seen = new Set<string>();
  const ordered: MusicTrack[] = [];
  for (const entry of entries) {
    const track = tracksById.get(entry.trackId);
    if (track && !seen.has(track.id)) {
      seen.add(track.id);
      ordered.push(track);
    }
  }
  return ordered;
}
