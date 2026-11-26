import type { AlbumMedia, AppThemeId, BirthdayCalendar, BirthdayNotificationSchedule, BirthdayReminderMode, Book, BookExcerpt, BookFormat, BookList, BookListEntry, BookLocationType, BookParseStatus, CheckIn, Draft, Gender, LedgerTransaction, Media, MusicCollectionEntry, MusicPlaybackMode, MusicPlaylist, MusicPlaylistEntry, MusicQuality, MusicTrack, NameStyleId, Person, PersonAlbum, PersonBook, PersonEvent, PersonPrivacyMode, PersonRelationship, PersonRelationshipKind, PersonRelationshipNode, PersonRelationshipNodeKind, PersonTagAssignment, Post, ProfileCollectionField, ProfileCollectionRequestStatus, ReaderTocItem, ReadingNoteSource, TagDefinition, TagGroup, TagSystemSetting } from '@still-alive/types';
import type { MemoryNotificationExposure, MemoryNotificationSchedule } from '../../features/home/memory-notifications';
import type { MemoryItem, MemoryRevision, MemorySourceRow } from '../../features/ai/domain/knowledge-types';

export interface CheckInRow { id: string; day_key: string; city: string | null; created_at: string; }
export interface PostRow { comments_json: string; id: string; day_key: string; body_markdown: string; location_name: string | null; pinned: number; created_at: string; updated_at: string; }
export interface DraftRow { id: string; day_key: string; body_markdown: string; updated_at: string; }
export interface LedgerTransactionRow { id: string; type: LedgerTransaction['type']; amount_cents: number; category: string; day_key: string; note: string | null; created_at: string; updated_at: string; }
export interface PersonRow {
  id: string; name: string; nickname: string | null; bio: string | null; avatar_media_id: string | null; gender: Gender | null; relation_to_me: string | null; impression: string | null;
  birthday_calendar: 'solar' | 'lunar' | null; birthday_year: number | null; birthday_month: number | null; birthday_day: number | null;
  birthday_is_leap_month: number; birthday_reminder_mode: BirthdayReminderMode | null; birthday_reminder_enabled: number;
  birthday_reminder_hour: number | null; birthday_reminder_minute: number | null; contacts_json: string | null; custom_fields_json: string | null; important_dates_json: string | null; privacy_mode: PersonPrivacyMode | null; memory_enabled: number; created_at: string; updated_at: string;
}
export interface PersonEventRow { id: string; person_id: string; title: string; description: string | null; time_text: string | null; participant_ids_json: string | null; pinned: number; sort_order: number; created_at: string; updated_at: string; }
export interface MediaRow { id: string; local_path: string; mime_type: string; width: number | null; height: number | null; checksum: string; created_at: string; kind?: 'image' | 'video' | 'audio' | 'book' | null; original_name?: string | null; size_bytes?: number | null; }
export interface MusicTrackRow { id: string; media_id: string; cover_media_id: string | null; title: string; artist: string | null; album: string | null; duration_ms: number | null; quality: MusicQuality | null; play_count: number; created_at: string; updated_at: string; }
export interface MusicCollectionEntryRow { track_id: string; target_type: MusicCollectionEntry['targetType']; target_id: string; created_at: string; }
export interface MusicPlaylistRow { id: string; name: string; cover_media_id: string | null; created_at: string; updated_at: string; }
export interface MusicPlaylistEntryRow { playlist_id: string; track_id: string; added_at: string; }
export interface PersonBookRow { person_id: string; book_id: string; created_at: string; }
export interface PersonRelationshipRow { id: string; source_node_id: string; target_node_id: string; kind: PersonRelationshipKind; created_at: string; updated_at: string; }
export interface PersonRelationshipNodeRow { id: string; node_type: PersonRelationshipNodeKind; person_id: string | null; label: string | null; created_at: string; updated_at: string; }
export interface BookListRow { id: string; name: string; created_at: string; updated_at: string; }
export interface BookListEntryRow { list_id: string; book_id: string; added_at: string; }
export interface BookRow { id: string; file_media_id: string; cover_media_id: string | null; title: string; author: string | null; format: BookFormat; parse_status: BookParseStatus; parse_message: string | null; progress: number; last_read_at: string | null; location: string | null; location_type: BookLocationType | null; chapter_href: string | null; chapter_title: string | null; engine_version: string | null; page_count: number | null; chapter_cache_json: string | null; created_at: string; updated_at: string; }
export interface BookExcerptRow { id: string; book_id: string | null; book_title: string | null; text: string; location: string | null; note: string | null; location_type: BookLocationType | null; chapter_title: string | null; context_before: string | null; context_after: string | null; source_kind: 'selection' | 'manual' | null; created_at: string; }
export interface AiProviderProfileRow {
  id: string; label: string; kind: 'openai-compatible' | 'anthropic' | 'deepseek'; base_url: string; model_id: string; key_hint: string;
  supports_stream: number; supports_balance: number; enabled: number; is_default: number;
  last_probe_at: string | null; last_probe_status: string | null; last_probe_latency_ms: number | null; last_probe_message: string | null; models_json: string | null;
  reasoning_effort: string | null;
  created_at: string; updated_at: string;
}
export interface AiUsageRecordRow {
  id: string; provider_id: string; provider_kind: 'openai-compatible' | 'anthropic' | 'deepseek'; model_id: string; task_id: string;
  status: 'success' | 'failed' | 'cancelled'; error_code: string | null; input_tokens: number | null; cached_input_tokens: number | null;
  output_tokens: number | null; duration_ms: number; estimated_cost_micros: number | null; currency: string | null; created_at: string;
}
export interface AiConversationRow { id: string; title: string; created_at: string; updated_at: string; message_count: number; }
export interface AiChatMessageRow { id: string; conversation_id: string; role: 'user' | 'assistant'; text: string; question: string; failed: number; memory_count: number; sources_json: string | null; created_at: string; }

export interface KnowledgeSourceRow {
  source_kind: string; source_id: string; content_hash: string; chunk_count: number; indexed_at: string;
}
export interface KnowledgeChunkRow {
  id: string; source_kind: string; source_id: string; chunk_index: number; day_key: string | null; person_ids_json: string | null;
  tag_keys_json: string | null; title: string | null; context_prefix: string; body_text: string; char_start: number; char_end: number;
  is_private: number; token_estimate: number; content_hash: string; source_updated_at: string | null; indexed_at: string;
}
export interface KnowledgeAggregateRow {
  id: string; kind: string; scope_key: string; title: string; body_markdown: string; stats_json: string | null; source_refs_json: string;
  generator: string; model_id: string | null; source_revision: string; stale: number; generated_at: string; updated_at: string;
}
export interface MemoryItemRow {
  id: string; kind: string; subject_type: string; subject_id: string | null; content: string; confidence: number; importance: number;
  status: string; origin: string; valid_from: string | null; valid_to: string | null; recorded_at: string; last_confirmed_at: string | null;
  extraction_batch_id: string | null; last_used_at: string | null; use_count: number; content_hash: string; created_at: string; updated_at: string;
}
export interface MemorySourceRowModel { memory_id: string; source_kind: string; source_id: string; }
export interface MemoryRevisionRowModel {
  id: string; memory_id: string; action: string; before_json: string | null; after_json: string | null; reason: string | null; created_at: string;
}

export interface ProfileCollectionRequestRow { id: string; person_id: string; fields_json: string; tag_map_json: string; expires_at: string; status: ProfileCollectionRequestStatus; invitation_url: string | null; created_at: string; consumed_at: string | null; }

export interface BackupSnapshot {
  checkIns: CheckIn[]; posts: Post[]; drafts: Draft[]; people: Person[]; media: Media[];
  ledgerTransactions?: LedgerTransaction[];
  postPersons: Array<{ postId: string; personId: string }>;
  settings: Record<string, string>;
  tagDefinitions?: TagDefinition[]; tagSystemSettings?: TagSystemSetting[]; personTags?: PersonTagAssignment[]; tagGroups?: TagGroup[];
  albums?: PersonAlbum[]; albumMedia?: AlbumMedia[]; personBooks?: PersonBook[]; musicTracks?: MusicTrack[]; musicCollectionEntries?: MusicCollectionEntry[];
  personRelationships?: PersonRelationship[];
  personRelationshipNodes?: PersonRelationshipNode[];
  personEvents?: PersonEvent[];
  musicPlaylists?: MusicPlaylist[]; musicPlaylistEntries?: MusicPlaylistEntry[];
  bookLists?: BookList[]; bookListEntries?: BookListEntry[];
  books?: Book[]; bookExcerpts?: BookExcerpt[]; readingNoteSources?: ReadingNoteSource[];
  memoryItems?: MemoryItem[]; memorySources?: MemorySourceRow[]; memoryRevisions?: MemoryRevision[];
}

export interface AppPreferences {
  onboardingCompleted: boolean; profileName: string; nickname: string; profileBio: string; profileSignature: string; profileGender: Gender | null;
  appearanceTheme: AppThemeId; selfNameStyle: NameStyleId; friendNameStyle: NameStyleId; birthDate: string; birthDateCalendar: BirthdayCalendar;
  birthDateIsLeapMonth: boolean; profileAvatarMediaId: string | null; profileMbti: string; profileCustomTagIds: string[]; globalMemoryEnabled: boolean;
  lastExportAt: string | null; lastExportPostCount: number; backupReminderShownAt: string | null; notificationPromptShownAt: string | null; birthdayNotificationsEnabled: boolean;
  birthdayReminderHour: number; birthdayReminderMinute: number; birthdayNotificationError: string | null; memoryNotificationsEnabled: boolean;
  memoryNotificationError: string | null; persistentNotificationEnabled: boolean; musicPlaybackMode: MusicPlaybackMode; miniPlayerX: number;
  miniPlayerY: number; miniPlayerEdge: 'left' | 'right' | null; miniPlayerYRatio: number | null; readerPreferencesJson: string; hapticsEnabled: boolean;
}

export type HomeMemory =
  | { kind: 'onThisDay'; post: Post }
  | { kind: 'person'; post: Post; person: { id: string; name: string; nickname: string } };

export type { MemoryNotificationExposure, MemoryNotificationSchedule };
