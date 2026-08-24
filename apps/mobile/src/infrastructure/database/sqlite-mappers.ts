import type { AppThemeId, Book, BookExcerpt, CheckIn, DayKey, Draft, Gender, Media, MusicTrack, NameStyleId, Person, Post, ProfileCollectionField, ProfileCollectionRequest, ReaderTocItem, ReadingNoteSource, TagSystemSetting } from '@still-alive/types';
import type { BookExcerptRow, BookRow, CheckInRow, DraftRow, MediaRow, MusicTrackRow, PersonRow, PostRow, ProfileCollectionRequestRow } from './database-models';

export function mapCheckIn(row: CheckInRow): CheckIn {
  return { id: row.id, dayKey: row.day_key as DayKey, city: row.city, createdAt: row.created_at };
}

export function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    dayKey: row.day_key as DayKey,
    bodyMarkdown: row.body_markdown,
    locationName: row.location_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    dayKey: row.day_key as DayKey,
    bodyMarkdown: row.body_markdown,
    updatedAt: row.updated_at,
  };
}

export function parseStringList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function parseGender(value: string | undefined): Gender | null {
  return value === 'female' || value === 'male' || value === 'other' ? value : null;
}

export function parseAppTheme(value: string | undefined): AppThemeId {
  return value === 'sand' || value === 'midnight' ? value : 'moss';
}

export function parseNameStyle(value: string | undefined, fallback: NameStyleId): NameStyleId {
  return value === 'fresh' || value === 'journal' || value === 'sunlit' || value === 'colorful' || value === 'iridescent' ? value : fallback;
}

export function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    avatarMediaId: row.avatar_media_id,
    gender: parseGender(row.gender ?? undefined),
    relationToMe: row.relation_to_me,
    impression: row.impression,
    birthday: row.birthday_calendar && row.birthday_year && row.birthday_month && row.birthday_day ? {
      calendar: row.birthday_calendar,
      year: row.birthday_year,
      month: row.birthday_month,
      day: row.birthday_day,
      isLeapMonth: row.birthday_is_leap_month === 1,
      reminderEnabled: row.birthday_reminder_enabled === 1,
      reminderHour: row.birthday_reminder_hour,
      reminderMinute: row.birthday_reminder_minute,
      reminderMode: row.birthday_reminder_mode ?? row.birthday_calendar,
    } : null,
    memoryEnabled: row.memory_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMedia(row: MediaRow): Media {
  return {
    id: row.id,
    localPath: row.local_path,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    checksum: row.checksum,
    createdAt: row.created_at,
    kind: row.kind ?? mediaKindForMimeType(row.mime_type),
    originalName: row.original_name ?? null,
    sizeBytes: row.size_bytes ?? null,
  };
}

function mediaKindForMimeType(mimeType: string): 'image' | 'video' | 'audio' {
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'image';
}

export function mapMusicTrack(row: MusicTrackRow): MusicTrack {
  return { id: row.id, mediaId: row.media_id, coverMediaId: row.cover_media_id, title: row.title, artist: row.artist, album: row.album, durationMs: row.duration_ms, playCount: row.play_count, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function mapBook(row: BookRow): Book {
  return { id: row.id, fileMediaId: row.file_media_id, coverMediaId: row.cover_media_id, title: row.title, author: row.author, format: row.format, parseStatus: row.parse_status, parseMessage: row.parse_message, progress: row.progress, lastReadAt: row.last_read_at, location: row.location, locationType: row.location_type, chapterHref: row.chapter_href, chapterTitle: row.chapter_title, engineVersion: row.engine_version, pageCount: row.page_count, chapterCache: parseReaderToc(row.chapter_cache_json), createdAt: row.created_at, updatedAt: row.updated_at };
}

export function parseReaderToc(value: string | null): ReaderTocItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ReaderTocItem => Boolean(item) && typeof item === 'object' && typeof (item as ReaderTocItem).href === 'string' && typeof (item as ReaderTocItem).label === 'string' && Number.isInteger((item as ReaderTocItem).depth));
  } catch {
    return [];
  }
}

export function mapBookExcerpt(row: BookExcerptRow): BookExcerpt {
  return { id: row.id, bookId: row.book_id, text: row.text, location: row.location, note: row.note, locationType: row.location_type, chapterTitle: row.chapter_title, contextBefore: row.context_before, contextAfter: row.context_after, sourceKind: row.source_kind ?? 'manual', createdAt: row.created_at };
}

export function mapProfileCollectionRequest(row: ProfileCollectionRequestRow): ProfileCollectionRequest {
  return {
    id: row.id,
    personId: row.person_id,
    fields: parseProfileCollectionFields(row.fields_json),
    tagMap: parseStringMap(row.tag_map_json),
    expiresAt: row.expires_at,
    status: row.status === 'consumed' ? 'consumed' : 'pending',
    createdAt: row.created_at,
    consumedAt: row.consumed_at,
  };
}

export function parseProfileCollectionFields(value: string): ProfileCollectionField[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ProfileCollectionField => item === 'name' || item === 'gender' || item === 'birthday' || item === 'mbti' || item === 'customTags');
  } catch {
    return [];
  }
}

export function parseStringMap(value: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

export function parseQuoteSnapshots(value: string): ReadingNoteSource['quoteSnapshots'] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const value = item as Record<string, unknown>;
      if (typeof value.bookTitle !== 'string' || typeof value.text !== 'string' || (value.location !== null && typeof value.location !== 'string')) return [];
      return [{ bookTitle: value.bookTitle, text: value.text, location: value.location as string | null }];
    });
  } catch {
    return [];
  }
}

export function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultTagSystemSettings(): TagSystemSetting[] {
  return [
    { system: 'mbti', enabled: true, sortOrder: 0 },
    { system: 'constellation', enabled: true, sortOrder: 1 },
    { system: 'zodiac', enabled: true, sortOrder: 2 },
    { system: 'custom', enabled: true, sortOrder: 3 },
  ];
}
