export type DayKey = `${number}-${number}-${number}`;
export type BirthdayCalendar = 'solar' | 'lunar';
export type BuiltInTagSystem = 'mbti' | 'constellation' | 'zodiac' | 'custom';

export interface Birthday {
  calendar: BirthdayCalendar;
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
}

export interface CheckIn {
  id: string;
  dayKey: DayKey;
  createdAt: string;
}

export interface Post {
  id: string;
  dayKey: DayKey;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  avatarMediaId: string | null;
  relationToMe: string | null;
  impression: string | null;
  birthday: Birthday | null;
  memoryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
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
}

export interface Draft {
  id: string;
  dayKey: DayKey;
  bodyMarkdown: string;
  updatedAt: string;
}
