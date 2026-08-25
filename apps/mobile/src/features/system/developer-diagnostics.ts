import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Book, Media, MusicTrack, Person, PersonAlbum, Post, AlbumMedia } from '@still-alive/types';
import type { AppPreferences } from '../../infrastructure/database/database-models';
import { extractEmbeddedMediaIds } from '../journal/embedded-media';

const DIAGNOSTIC_TABLES = [
  'checkins', 'posts', 'drafts', 'persons', 'media', 'memory_exposures', 'settings',
  'tag_definitions', 'tag_groups', 'person_tag_assignments', 'person_albums', 'album_media',
  'birthday_notification_schedules', 'memory_notification_schedules', 'profile_collection_requests',
  'music_tracks', 'music_collection_entries', 'music_playlists', 'music_playlist_entries',
  'book_lists', 'book_list_entries', 'books', 'book_excerpts', 'reading_note_sources',
] as const;

export interface DatabaseDiagnostics {
  version: number;
  counts: Array<{ table: string; count: number }>;
  foreignKeyViolations: number;
  durationMs: number;
}

export interface MediaHealthDiagnostics {
  missingFiles: number;
  orphanedRecords: number;
  totalBytes: number;
}

export interface StorageDiagnostics {
  documentBytes: number;
  cacheBytes: number;
}

export async function inspectDatabase(db: SQLiteDatabase): Promise<DatabaseDiagnostics> {
  const startedAt = Date.now();
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const counts = await Promise.all(DIAGNOSTIC_TABLES.map(async (table) => {
    const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
    return { table, count: Number(row?.count ?? 0) };
  }));
  const foreignKeys = await db.getAllAsync<{ table: string; rowid: number; parent: string; fkid: number }>('PRAGMA foreign_key_check');
  return { version: Number(versionRow?.user_version ?? 0), counts, foreignKeyViolations: foreignKeys.length, durationMs: Date.now() - startedAt };
}

export function inspectMediaHealth(
  media: Media[],
  posts: Post[],
  people: Person[],
  albums: PersonAlbum[],
  albumMedia: AlbumMedia[],
  musicTracks: MusicTrack[],
  books: Book[],
  preferences: AppPreferences,
): MediaHealthDiagnostics {
  const referenced = new Set<string>();
  posts.forEach((post) => extractEmbeddedMediaIds(post.bodyMarkdown).forEach((id) => referenced.add(id)));
  people.forEach((person) => person.avatarMediaId && referenced.add(person.avatarMediaId));
  albums.forEach((album) => album.coverMediaId && referenced.add(album.coverMediaId));
  albumMedia.forEach((item) => referenced.add(item.mediaId));
  musicTracks.forEach((track) => {
    referenced.add(track.mediaId);
    if (track.coverMediaId) referenced.add(track.coverMediaId);
  });
  books.forEach((book) => {
    referenced.add(book.fileMediaId);
    if (book.coverMediaId) referenced.add(book.coverMediaId);
  });
  if (preferences.profileAvatarMediaId) referenced.add(preferences.profileAvatarMediaId);

  let missingFiles = 0;
  let totalBytes = 0;
  for (const item of media) {
    const file = new File(item.localPath);
    if (!file.exists) missingFiles += 1;
    totalBytes += Number(item.sizeBytes ?? (file.exists ? file.size : 0));
  }
  return { missingFiles, orphanedRecords: media.filter((item) => !referenced.has(item.id)).length, totalBytes };
}

export function inspectStorage(): StorageDiagnostics {
  return { documentBytes: directoryBytes(Paths.document), cacheBytes: directoryBytes(Paths.cache) };
}

export async function readLogTail(file: File, filter: 'ALL' | 'INFO' | 'WARN' | 'ERROR' = 'ALL'): Promise<string[]> {
  if (!file.exists) return [];
  const lines = (await file.text()).trim().split('\n').filter(Boolean);
  return lines.filter((line) => filter === 'ALL' || line.includes(` ${filter} `)).slice(-40).reverse();
}

export function clearDirectoryContents(directory: Directory): number {
  let removed = 0;
  try {
    for (const entry of directory.list()) {
      try {
        entry.delete();
        removed += 1;
      } catch {
        // 单个缓存文件不可删除时继续处理其他文件。
      }
    }
  } catch {
    // 目录不存在或当前平台不可访问时保持幂等。
  }
  return removed;
}

function directoryBytes(directory: Directory): number {
  try {
    return directory.list().reduce((total, entry) => total + (entry instanceof Directory ? directoryBytes(entry) : entry.size), 0);
  } catch {
    return 0;
  }
}
