export type DayKey = `${number}-${number}-${number}`;
export type BirthdayCalendar = 'solar' | 'lunar';
export type BirthdayReminderMode = BirthdayCalendar | 'both';
export type BuiltInTagSystem = 'mbti' | 'constellation' | 'zodiac' | 'custom';
export type Gender = 'female' | 'male' | 'other';
export type AppThemeId = 'moss' | 'sand' | 'midnight';
export type NameStyleId = 'fresh' | 'journal' | 'sunlit' | 'colorful' | 'iridescent';
export type ProfileCollectionField = 'name' | 'nickname' | 'bio' | 'gender' | 'birthday' | 'mbti' | 'customTags';
export type ProfileCollectionRequestStatus = 'pending' | 'consumed';
export type MusicCollectionTargetType = 'self' | 'person';
export type MusicPlaybackMode = 'list' | 'shuffle' | 'single';
export type BookFormat = 'pdf' | 'epub' | 'mobi' | 'txt' | 'html' | 'fb2' | 'azw' | 'azw3';
export type BookParseStatus = 'ready' | 'protected' | 'unsupported' | 'failed';
export type BookLocationType = 'epub-cfi' | 'reflow-cfi' | 'pdf-page' | 'manual';
export type ReaderTheme = 'paper' | 'warm' | 'green' | 'night';
export type ReaderFontFamily = 'serif' | 'sans';
export type ReaderFlow = 'paginated' | 'scrolled';

export interface ReaderTocItem {
  href: string;
  label: string;
  depth: number;
}

export interface ReadingPreferences {
  theme: ReaderTheme;
  showStatusBar: boolean;
  fontSize: number;
  lineHeight: number;
  pageMargin: number;
  fontFamily: ReaderFontFamily;
  fontName: string | null;
  flow: ReaderFlow;
  pdfScale: number;
  pdfHorizontal: boolean;
  pdfThemeEnabled: boolean;
}

export interface Birthday {
  calendar: BirthdayCalendar;
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  reminderMode: BirthdayReminderMode;
  reminderEnabled: boolean;
  reminderHour: number | null;
  reminderMinute: number | null;
}

export interface CheckIn {
  id: string;
  dayKey: DayKey;
  city: string | null;
  createdAt: string;
}

export interface Post {
  id: string;
  dayKey: DayKey;
  bodyMarkdown: string;
  locationName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  nickname: string;
  bio: string | null;
  avatarMediaId: string | null;
  gender: Gender | null;
  relationToMe: string | null;
  impression: string | null;
  birthday: Birthday | null;
  memoryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileCollectionRequest {
  id: string;
  personId: string;
  fields: ProfileCollectionField[];
  tagMap: Record<string, string>;
  expiresAt: string;
  status: ProfileCollectionRequestStatus;
  createdAt: string;
  consumedAt: string | null;
}

export interface TagSystemSetting {
  system: BuiltInTagSystem;
  enabled: boolean;
  sortOrder: number;
}

export interface TagDefinition {
  id: string;
  name: string;
  normalizedName: string;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TagGroup {
  id: string;
  name: string;
  kind: 'group';
  createdAt: string;
  updatedAt: string;
}

export interface PersonTagAssignment {
  personId: string;
  kind: 'mbti' | 'custom';
  value: string;
}

export interface PersonBook {
  personId: string;
  bookId: string;
  createdAt: string;
}

export interface PersonAlbum {
  id: string;
  personId: string | null;
  name: string;
  coverMediaId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumMedia {
  albumId: string;
  mediaId: string;
  sortOrder: number;
  addedAt: string;
}

export interface BirthdayNotificationPreferences {
  enabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  lastError: string | null;
}

export interface BirthdayNotificationSchedule {
  id: string;
  personId: string;
  eventType: 'advance' | 'today';
  birthdayDayKey: DayKey;
  scheduledAt: string;
  platformIdentifier: string;
}

export interface Media {
  id: string;
  localPath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  checksum: string;
  createdAt: string;
  kind?: 'image' | 'video' | 'audio' | 'book';
  originalName?: string | null;
  sizeBytes?: number | null;
}

export interface MusicTrack {
  id: string;
  mediaId: string;
  coverMediaId: string | null;
  title: string;
  artist: string | null;
  album: string | null;
  durationMs: number | null;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MusicCollectionEntry {
  trackId: string;
  targetType: MusicCollectionTargetType;
  targetId: string | null;
  createdAt: string;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  coverMediaId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MusicPlaylistEntry {
  playlistId: string;
  trackId: string;
  addedAt: string;
}

export interface BookList {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookListEntry {
  listId: string;
  bookId: string;
  addedAt: string;
}

export interface MusicPlaybackPreferences {
  mode: MusicPlaybackMode;
  miniPlayerX: number;
  miniPlayerY: number;
}

export interface Book {
  id: string;
  fileMediaId: string;
  coverMediaId: string | null;
  title: string;
  author: string | null;
  format: BookFormat;
  parseStatus: BookParseStatus;
  parseMessage: string | null;
  progress: number;
  lastReadAt: string | null;
  location: string | null;
  locationType?: BookLocationType | null;
  chapterHref?: string | null;
  chapterTitle?: string | null;
  engineVersion?: string | null;
  pageCount?: number | null;
  chapterCache?: ReaderTocItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BookExcerpt {
  id: string;
  bookId: string;
  text: string;
  location: string | null;
  note: string | null;
  locationType?: BookLocationType | null;
  chapterTitle?: string | null;
  contextBefore?: string | null;
  contextAfter?: string | null;
  sourceKind?: 'selection' | 'manual';
  createdAt: string;
}

export interface ReadingNoteSource {
  postId: string;
  bookId: string | null;
  excerptIds: string[];
  quoteSnapshots: Array<{ bookTitle: string; text: string; location: string | null }>;
}

export interface Draft {
  id: string;
  dayKey: DayKey;
  bodyMarkdown: string;
  updatedAt: string;
}
