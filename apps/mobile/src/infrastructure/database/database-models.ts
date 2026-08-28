import type { AlbumMedia, AppThemeId, BirthdayCalendar, BirthdayNotificationSchedule, BirthdayReminderMode, Book, BookExcerpt, BookFormat, BookList, BookListEntry, BookLocationType, BookParseStatus, CheckIn, Draft, Gender, Media, MusicCollectionEntry, MusicPlaybackMode, MusicPlaylist, MusicPlaylistEntry, MusicTrack, NameStyleId, Person, PersonAlbum, PersonBook, PersonTagAssignment, Post, ProfileCollectionField, ProfileCollectionRequestStatus, ReaderTocItem, ReadingNoteSource, TagDefinition, TagGroup, TagSystemSetting } from '@still-alive/types';
import type { MemoryNotificationExposure, MemoryNotificationSchedule } from '../../features/home/memory-notifications';

export interface CheckInRow { id: string; day_key: string; city: string | null; created_at: string; }
export interface PostRow { id: string; day_key: string; body_markdown: string; location_name: string | null; created_at: string; updated_at: string; }
export interface DraftRow { id: string; day_key: string; body_markdown: string; updated_at: string; }
export interface PersonRow {
  id: string; name: string; nickname: string | null; bio: string | null; avatar_media_id: string | null; gender: Gender | null; relation_to_me: string | null; impression: string | null;
  birthday_calendar: 'solar' | 'lunar' | null; birthday_year: number | null; birthday_month: number | null; birthday_day: number | null;
  birthday_is_leap_month: number; birthday_reminder_mode: BirthdayReminderMode | null; birthday_reminder_enabled: number;
  birthday_reminder_hour: number | null; birthday_reminder_minute: number | null; memory_enabled: number; created_at: string; updated_at: string;
}
export interface MediaRow { id: string; local_path: string; mime_type: string; width: number | null; height: number | null; checksum: string; created_at: string; kind?: 'image' | 'video' | 'audio' | 'book' | null; original_name?: string | null; size_bytes?: number | null; }
export interface MusicTrackRow { id: string; media_id: string; cover_media_id: string | null; title: string; artist: string | null; album: string | null; duration_ms: number | null; play_count: number; created_at: string; updated_at: string; }
export interface MusicCollectionEntryRow { track_id: string; target_type: MusicCollectionEntry['targetType']; target_id: string; created_at: string; }
export interface MusicPlaylistRow { id: string; name: string; cover_media_id: string | null; created_at: string; updated_at: string; }
export interface MusicPlaylistEntryRow { playlist_id: string; track_id: string; added_at: string; }
export interface PersonBookRow { person_id: string; book_id: string; created_at: string; }
export interface BookListRow { id: string; name: string; created_at: string; updated_at: string; }
export interface BookListEntryRow { list_id: string; book_id: string; added_at: string; }
export interface BookRow { id: string; file_media_id: string; cover_media_id: string | null; title: string; author: string | null; format: BookFormat; parse_status: BookParseStatus; parse_message: string | null; progress: number; last_read_at: string | null; location: string | null; location_type: BookLocationType | null; chapter_href: string | null; chapter_title: string | null; engine_version: string | null; page_count: number | null; chapter_cache_json: string | null; created_at: string; updated_at: string; }
export interface BookExcerptRow { id: string; book_id: string; text: string; location: string | null; note: string | null; location_type: BookLocationType | null; chapter_title: string | null; context_before: string | null; context_after: string | null; source_kind: 'selection' | 'manual' | null; created_at: string; }
export interface ProfileCollectionRequestRow { id: string; person_id: string; fields_json: string; tag_map_json: string; expires_at: string; status: ProfileCollectionRequestStatus; created_at: string; consumed_at: string | null; }

export interface BackupSnapshot {
  checkIns: CheckIn[]; posts: Post[]; drafts: Draft[]; people: Person[]; media: Media[];
  postPersons: Array<{ postId: string; personId: string }>;
  settings: Record<string, string>;
  tagDefinitions?: TagDefinition[]; tagSystemSettings?: TagSystemSetting[]; personTags?: PersonTagAssignment[]; tagGroups?: TagGroup[];
  albums?: PersonAlbum[]; albumMedia?: AlbumMedia[]; personBooks?: PersonBook[]; musicTracks?: MusicTrack[]; musicCollectionEntries?: MusicCollectionEntry[];
  musicPlaylists?: MusicPlaylist[]; musicPlaylistEntries?: MusicPlaylistEntry[];
  bookLists?: BookList[]; bookListEntries?: BookListEntry[];
  books?: Book[]; bookExcerpts?: BookExcerpt[]; readingNoteSources?: ReadingNoteSource[];
}

export interface AppPreferences {
  onboardingCompleted: boolean; profileName: string; nickname: string; profileBio: string; profileSignature: string; profileGender: Gender | null;
  appearanceTheme: AppThemeId; selfNameStyle: NameStyleId; friendNameStyle: NameStyleId; birthDate: string; birthDateCalendar: BirthdayCalendar;
  birthDateIsLeapMonth: boolean; profileAvatarMediaId: string | null; profileMbti: string; profileCustomTagIds: string[]; globalMemoryEnabled: boolean;
  lastExportAt: string | null; lastExportPostCount: number; backupReminderShownAt: string | null; birthdayNotificationsEnabled: boolean;
  birthdayReminderHour: number; birthdayReminderMinute: number; birthdayNotificationError: string | null; memoryNotificationsEnabled: boolean;
  memoryNotificationError: string | null; persistentNotificationEnabled: boolean; musicPlaybackMode: MusicPlaybackMode; miniPlayerX: number;
  miniPlayerY: number; miniPlayerEdge: 'left' | 'right' | null; miniPlayerYRatio: number | null; readerPreferencesJson: string;
}

export type HomeMemory =
  | { kind: 'onThisDay'; post: Post }
  | { kind: 'person'; post: Post; person: { id: string; name: string; nickname: string } };

export type { MemoryNotificationExposure, MemoryNotificationSchedule };
