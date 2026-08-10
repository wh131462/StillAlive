import type { SQLiteDatabase } from 'expo-sqlite';
import type { StillAliveRepository } from '@still-alive/storage';
import type { AlbumMedia, AppThemeId, BirthdayCalendar, BirthdayNotificationSchedule, BirthdayReminderMode, CheckIn, DayKey, Draft, Gender, Media, NameStyleId, Person, PersonAlbum, PersonTagAssignment, Post, TagDefinition, TagGroup, TagSystemSetting } from '@still-alive/types';
import type { MemoryNotificationExposure, MemoryNotificationSchedule } from '../domain/memory-notifications';

interface CheckInRow {
  id: string;
  day_key: string;
  city: string | null;
  created_at: string;
}

interface PostRow {
  id: string;
  day_key: string;
  body_markdown: string;
  location_name: string | null;
  created_at: string;
  updated_at: string;
}

interface DraftRow {
  id: string;
  day_key: string;
  body_markdown: string;
  updated_at: string;
}

interface PersonRow {
  id: string;
  name: string;
  avatar_media_id: string | null;
  gender: Gender | null;
  relation_to_me: string | null;
  impression: string | null;
  birthday_calendar: 'solar' | 'lunar' | null;
  birthday_year: number | null;
  birthday_month: number | null;
  birthday_day: number | null;
  birthday_is_leap_month: number;
  birthday_reminder_mode: BirthdayReminderMode | null;
  birthday_reminder_enabled: number;
  birthday_reminder_hour: number | null;
  birthday_reminder_minute: number | null;
  memory_enabled: number;
  created_at: string;
  updated_at: string;
}

interface MediaRow {
  id: string;
  local_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  checksum: string;
  created_at: string;
}

export interface BackupSnapshot {
  checkIns: CheckIn[];
  posts: Post[];
  drafts: Draft[];
  people: Person[];
  media: Media[];
  postPersons: Array<{ postId: string; personId: string }>;
  settings: Record<string, string>;
  tagDefinitions?: TagDefinition[];
  tagSystemSettings?: TagSystemSetting[];
  personTags?: PersonTagAssignment[];
  tagGroups?: TagGroup[];
  albums?: PersonAlbum[];
  albumMedia?: AlbumMedia[];
}

export interface AppPreferences {
  onboardingCompleted: boolean;
  nickname: string;
  profileBio: string;
  profileSignature: string;
  profileGender: Gender | null;
  appearanceTheme: AppThemeId;
  selfNameStyle: NameStyleId;
  friendNameStyle: NameStyleId;
  birthDate: string;
  birthDateCalendar: BirthdayCalendar;
  birthDateIsLeapMonth: boolean;
  profileAvatarMediaId: string | null;
  profileMbti: string;
  profileCustomTagIds: string[];
  globalMemoryEnabled: boolean;
  lastExportAt: string | null;
  lastExportPostCount: number;
  backupReminderShownAt: string | null;
  birthdayNotificationsEnabled: boolean;
  birthdayReminderHour: number;
  birthdayReminderMinute: number;
  birthdayNotificationError: string | null;
  memoryNotificationsEnabled: boolean;
  memoryNotificationError: string | null;
  persistentNotificationEnabled: boolean;
}

export type HomeMemory =
  | { kind: 'onThisDay'; post: Post }
  | { kind: 'person'; post: Post; person: { id: string; name: string } };

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;
  if (currentVersion < 1) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY NOT NULL,
      day_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY NOT NULL,
      day_key TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS posts_day_key_idx ON posts(day_key, created_at DESC);

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY NOT NULL,
      day_key TEXT NOT NULL UNIQUE,
      body_markdown TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      avatar_media_id TEXT,
      relation_to_me TEXT,
      impression TEXT,
      memory_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_persons (
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, person_id)
    );
    CREATE INDEX IF NOT EXISTS post_persons_person_idx ON post_persons(person_id, post_id);

    PRAGMA user_version = 1;
  `);

  if (currentVersion < 2) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY NOT NULL,
      local_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    PRAGMA user_version = 2;
  `);

  if (currentVersion < 3) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS memory_exposures (
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      shown_at TEXT NOT NULL,
      PRIMARY KEY (post_id, kind)
    );
    PRAGMA user_version = 3;
  `);

  if (currentVersion < 4) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    PRAGMA user_version = 4;
  `);

  if (currentVersion < 5) await db.execAsync(`
    ALTER TABLE persons ADD COLUMN birthday_calendar TEXT;
    ALTER TABLE persons ADD COLUMN birthday_year INTEGER;
    ALTER TABLE persons ADD COLUMN birthday_month INTEGER;
    ALTER TABLE persons ADD COLUMN birthday_day INTEGER;
    ALTER TABLE persons ADD COLUMN birthday_is_leap_month INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS tag_system_settings (
      system TEXT PRIMARY KEY NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO tag_system_settings (system, enabled, sort_order) VALUES
      ('mbti', 1, 0), ('constellation', 1, 1), ('zodiac', 1, 2), ('custom', 1, 3);

    CREATE TABLE IF NOT EXISTS tag_definitions (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tag_groups (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS person_tag_assignments (
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (person_id, kind, value)
    );
    CREATE INDEX IF NOT EXISTS person_tags_person_idx ON person_tag_assignments(person_id, kind);

    CREATE TABLE IF NOT EXISTS person_albums (
      id TEXT PRIMARY KEY NOT NULL,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      cover_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS person_albums_person_idx ON person_albums(person_id, sort_order);
    CREATE TABLE IF NOT EXISTS album_media (
      album_id TEXT NOT NULL REFERENCES person_albums(id) ON DELETE CASCADE,
      media_id TEXT NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      added_at TEXT NOT NULL,
      PRIMARY KEY (album_id, media_id)
    );
    CREATE INDEX IF NOT EXISTS album_media_album_idx ON album_media(album_id, sort_order);

    CREATE TABLE IF NOT EXISTS birthday_notification_schedules (
      id TEXT PRIMARY KEY NOT NULL,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      birthday_day_key TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      platform_identifier TEXT NOT NULL UNIQUE
    );
    PRAGMA user_version = 5;
  `);

  if (currentVersion < 6) await db.execAsync(`
    ALTER TABLE tag_definitions ADD COLUMN group_id TEXT;
    CREATE TABLE IF NOT EXISTS tag_groups (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    PRAGMA user_version = 6;
  `);

  if (currentVersion < 7) {
    await repairAlbumTablesBeforeV7(db);
    await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    BEGIN IMMEDIATE;
    DROP INDEX IF EXISTS person_albums_person_idx;
    DROP INDEX IF EXISTS album_media_album_idx;
    ALTER TABLE album_media RENAME TO album_media_v6;
    ALTER TABLE person_albums RENAME TO person_albums_v6;
    CREATE TABLE person_albums (
      id TEXT PRIMARY KEY NOT NULL,
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      cover_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX person_albums_person_idx ON person_albums(person_id, sort_order);
    CREATE TABLE album_media (
      album_id TEXT NOT NULL REFERENCES person_albums(id) ON DELETE CASCADE,
      media_id TEXT NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      added_at TEXT NOT NULL,
      PRIMARY KEY (album_id, media_id)
    );
    CREATE INDEX album_media_album_idx ON album_media(album_id, sort_order);
    INSERT INTO person_albums SELECT * FROM person_albums_v6;
    INSERT INTO album_media SELECT * FROM album_media_v6;
    DROP TABLE album_media_v6;
    DROP TABLE person_albums_v6;
    PRAGMA user_version = 7;
    COMMIT;
    PRAGMA foreign_keys = ON;
    `);
  }

  if (currentVersion < 8) {
    await addColumnIfMissing(db, 'posts', 'audio_media_id', 'TEXT REFERENCES media(id) ON DELETE SET NULL');
    await addColumnIfMissing(db, 'posts', 'audio_duration_ms', 'INTEGER');
    await addColumnIfMissing(db, 'drafts', 'audio_media_id', 'TEXT REFERENCES media(id) ON DELETE SET NULL');
    await addColumnIfMissing(db, 'drafts', 'audio_duration_ms', 'INTEGER');
    await db.execAsync('PRAGMA user_version = 8;');
  }

  if (currentVersion < 9) {
    await migrateLegacyAudioColumns(db);
    await db.execAsync('PRAGMA user_version = 9;');
  }

  if (currentVersion < 10) {
    await addColumnIfMissing(db, 'memory_exposures', 'review_count', 'INTEGER NOT NULL DEFAULT 0');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS memory_notification_schedules (
        id TEXT PRIMARY KEY NOT NULL,
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        scheduled_at TEXT NOT NULL,
        platform_identifier TEXT NOT NULL UNIQUE
      );
      CREATE INDEX IF NOT EXISTS memory_notification_schedules_post_idx ON memory_notification_schedules(post_id);
      PRAGMA user_version = 10;
    `);
  }

  if (currentVersion < 11) {
    await migrateLegacyAudioColumns(db);
    await db.execAsync('PRAGMA user_version = 11;');
  }

  if (currentVersion < 12) {
    await addColumnIfMissing(db, 'persons', 'birthday_reminder_mode', 'TEXT');
    await db.execAsync(`
      UPDATE persons
      SET birthday_reminder_mode = birthday_calendar
      WHERE birthday_calendar IS NOT NULL AND birthday_reminder_mode IS NULL;
      PRAGMA user_version = 12;
    `);
  }

  if (currentVersion < 13) {
    await addColumnIfMissing(db, 'persons', 'gender', 'TEXT');
    await db.execAsync('PRAGMA user_version = 13;');
  }

  if (currentVersion < 14) {
    await addColumnIfMissing(db, 'checkins', 'city', 'TEXT');
    await addColumnIfMissing(db, 'posts', 'location_name', 'TEXT');
    await db.execAsync('PRAGMA user_version = 14;');
  }

  if (currentVersion < 15) {
    await addColumnIfMissing(db, 'persons', 'birthday_reminder_enabled', 'INTEGER NOT NULL DEFAULT 1');
    await addColumnIfMissing(db, 'persons', 'birthday_reminder_hour', 'INTEGER');
    await addColumnIfMissing(db, 'persons', 'birthday_reminder_minute', 'INTEGER');
    await db.execAsync('PRAGMA user_version = 15;');
  }
}

async function migrateLegacyAudioColumns(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    UPDATE posts
    SET body_markdown = CASE
      WHEN TRIM(body_markdown) = '' THEN '![语音](audio://' || audio_media_id || '?duration=' || COALESCE(audio_duration_ms, 0) || ')'
      ELSE body_markdown || CHAR(10) || CHAR(10) || '![语音](audio://' || audio_media_id || '?duration=' || COALESCE(audio_duration_ms, 0) || ')'
    END,
    audio_media_id = NULL,
    audio_duration_ms = NULL
    WHERE audio_media_id IS NOT NULL;

    UPDATE drafts
    SET body_markdown = CASE
      WHEN TRIM(body_markdown) = '' THEN '![语音](audio://' || audio_media_id || '?duration=' || COALESCE(audio_duration_ms, 0) || ')'
      ELSE body_markdown || CHAR(10) || CHAR(10) || '![语音](audio://' || audio_media_id || '?duration=' || COALESCE(audio_duration_ms, 0) || ')'
    END,
    audio_media_id = NULL,
    audio_duration_ms = NULL
    WHERE audio_media_id IS NOT NULL;
  `);
}

async function repairAlbumTablesBeforeV7(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    let hasAlbums = await tableExists(db, 'person_albums');
    let hasAlbumMedia = await tableExists(db, 'album_media');
    let hasLegacyAlbums = await tableExists(db, 'person_albums_v6');
    let hasLegacyAlbumMedia = await tableExists(db, 'album_media_v6');

    if (!hasAlbums && hasLegacyAlbums) {
      await db.execAsync('ALTER TABLE person_albums_v6 RENAME TO person_albums;');
      hasAlbums = true;
      hasLegacyAlbums = false;
    }
    if (!hasAlbumMedia && hasLegacyAlbumMedia) {
      await db.execAsync('ALTER TABLE album_media_v6 RENAME TO album_media;');
      hasAlbumMedia = true;
      hasLegacyAlbumMedia = false;
    }
    if (!hasAlbums) await db.execAsync(`
      CREATE TABLE person_albums (
        id TEXT PRIMARY KEY NOT NULL,
        person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        cover_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    if (!hasAlbumMedia) await db.execAsync(`
      CREATE TABLE album_media (
        album_id TEXT NOT NULL REFERENCES person_albums(id) ON DELETE CASCADE,
        media_id TEXT NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        added_at TEXT NOT NULL,
        PRIMARY KEY (album_id, media_id)
      );
    `);

    if (hasAlbums && hasLegacyAlbums) {
      await db.execAsync('INSERT OR IGNORE INTO person_albums SELECT * FROM person_albums_v6;');
    }
    if (hasAlbumMedia && hasLegacyAlbumMedia) {
      await db.execAsync('INSERT OR IGNORE INTO album_media SELECT * FROM album_media_v6;');
    }
    await db.execAsync('DROP TABLE IF EXISTS album_media_v6; DROP TABLE IF EXISTS person_albums_v6;');
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}

async function tableExists(db: SQLiteDatabase, table: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', 'table', table);
  return Boolean(row);
}

async function addColumnIfMissing(db: SQLiteDatabase, table: string, column: string, definition: string): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

export class SQLiteStillAliveRepository implements StillAliveRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async checkIn(dayKey: DayKey, city: string | null): Promise<CheckIn> {
    const existing = await this.getCheckIn(dayKey);
    if (existing) return existing;

    const checkIn: CheckIn = {
      id: createLocalId('checkin'),
      dayKey,
      city,
      createdAt: new Date().toISOString(),
    };
    await this.db.runAsync(
      'INSERT INTO checkins (id, day_key, city, created_at) VALUES (?, ?, ?, ?)',
      checkIn.id,
      checkIn.dayKey,
      checkIn.city,
      checkIn.createdAt,
    );
    return checkIn;
  }

  async getCheckIn(dayKey: DayKey): Promise<CheckIn | null> {
    const row = await this.db.getFirstAsync<CheckInRow>(
      'SELECT id, day_key, city, created_at FROM checkins WHERE day_key = ?',
      dayKey,
    );
    return row ? mapCheckIn(row) : null;
  }

  async listCheckIns(): Promise<CheckIn[]> {
    const rows = await this.db.getAllAsync<CheckInRow>(
      'SELECT id, day_key, city, created_at FROM checkins ORDER BY day_key DESC',
    );
    return rows.map(mapCheckIn);
  }

  async createPost(post: Post, personIds: string[] = []): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        'INSERT INTO posts (id, day_key, body_markdown, location_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        post.id,
        post.dayKey,
        post.bodyMarkdown,
        post.locationName,
        post.createdAt,
        post.updatedAt,
      );
      for (const personId of personIds) {
        await transaction.runAsync(
          'INSERT OR IGNORE INTO post_persons (post_id, person_id) VALUES (?, ?)',
          post.id,
          personId,
        );
      }
      await transaction.runAsync('DELETE FROM drafts WHERE day_key = ?', post.dayKey);
    });
  }

  async updatePost(post: Post, personIds: string[] = []): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        'UPDATE posts SET body_markdown = ?, location_name = ?, updated_at = ? WHERE id = ?',
        post.bodyMarkdown,
        post.locationName,
        post.updatedAt,
        post.id,
      );
      await transaction.runAsync('DELETE FROM post_persons WHERE post_id = ?', post.id);
      for (const personId of personIds) {
        await transaction.runAsync(
          'INSERT OR IGNORE INTO post_persons (post_id, person_id) VALUES (?, ?)',
          post.id,
          personId,
        );
      }
    });
  }

  async deletePost(postId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM posts WHERE id = ?', postId);
  }

  async listPersonIdsByPost(postId: string): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ person_id: string }>(
      'SELECT person_id FROM post_persons WHERE post_id = ? ORDER BY person_id',
      postId,
    );
    return rows.map((row) => row.person_id);
  }

  async listPosts(): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      'SELECT id, day_key, body_markdown, location_name, created_at, updated_at FROM posts ORDER BY day_key DESC, created_at DESC',
    );
    return rows.map(mapPost);
  }

  async listPostsByDay(dayKey: DayKey): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      'SELECT id, day_key, body_markdown, location_name, created_at, updated_at FROM posts WHERE day_key = ? ORDER BY created_at DESC',
      dayKey,
    );
    return rows.map(mapPost);
  }

  async listPostsByPerson(personId: string): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      `SELECT posts.id, posts.day_key, posts.body_markdown, posts.location_name, posts.created_at, posts.updated_at
       FROM posts
       INNER JOIN post_persons ON post_persons.post_id = posts.id
       WHERE post_persons.person_id = ?
       ORDER BY posts.day_key DESC, posts.created_at DESC`,
      personId,
    );
    return rows.map(mapPost);
  }

  async saveDraft(draft: Draft): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO drafts (id, day_key, body_markdown, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(day_key) DO UPDATE SET body_markdown = excluded.body_markdown, updated_at = excluded.updated_at`,
      draft.id,
      draft.dayKey,
      draft.bodyMarkdown,
      draft.updatedAt,
    );
  }

  async getDraft(dayKey: DayKey): Promise<Draft | null> {
    const row = await this.db.getFirstAsync<DraftRow>(
      'SELECT id, day_key, body_markdown, updated_at FROM drafts WHERE day_key = ?',
      dayKey,
    );
    return row ? mapDraft(row) : null;
  }

  async listMedia(): Promise<Media[]> {
    const rows = await this.db.getAllAsync<MediaRow>(
      'SELECT id, local_path, mime_type, width, height, checksum, created_at FROM media ORDER BY created_at DESC',
    );
    return rows.map(mapMedia);
  }

  async createMedia(media: Media): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO media (id, local_path, mime_type, width, height, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      media.id,
      media.localPath,
      media.mimeType,
      media.width,
      media.height,
      media.checksum,
      media.createdAt,
    );
  }

  async updateMedia(media: Media): Promise<void> {
    await this.db.runAsync(
      'UPDATE media SET local_path = ?, mime_type = ?, width = ?, height = ?, checksum = ?, created_at = ? WHERE id = ?',
      media.localPath,
      media.mimeType,
      media.width,
      media.height,
      media.checksum,
      media.createdAt,
      media.id,
    );
  }

  async deleteMedia(mediaId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM media WHERE id = ?', mediaId);
  }

  async isMediaReferenced(mediaId: string): Promise<boolean> {
    const imageReference = `%media://${mediaId}%`;
    const audioReference = `%audio://${mediaId}%`;
    const row = await this.db.getFirstAsync<{ referenced: number }>(
      `SELECT EXISTS(
        SELECT 1 FROM posts WHERE body_markdown LIKE ?
        UNION ALL
        SELECT 1 FROM drafts WHERE body_markdown LIKE ?
        UNION ALL
        SELECT 1 FROM posts WHERE body_markdown LIKE ?
        UNION ALL
        SELECT 1 FROM drafts WHERE body_markdown LIKE ?
        UNION ALL
        SELECT 1 FROM persons WHERE avatar_media_id = ?
        UNION ALL
        SELECT 1 FROM album_media WHERE media_id = ?
        UNION ALL
        SELECT 1 FROM settings WHERE key = 'profileAvatarMediaId' AND value = ?
      ) AS referenced`,
      imageReference,
      imageReference,
      audioReference,
      audioReference,
      mediaId,
      mediaId,
      mediaId,
    );
    return row?.referenced === 1;
  }

  async listPeople(): Promise<Person[]> {
    const rows = await this.db.getAllAsync<PersonRow>(
      `SELECT id, name, avatar_media_id, gender, relation_to_me, impression,
              birthday_calendar, birthday_year, birthday_month, birthday_day, birthday_is_leap_month, birthday_reminder_mode,
              birthday_reminder_enabled, birthday_reminder_hour, birthday_reminder_minute,
              memory_enabled, created_at, updated_at
       FROM persons ORDER BY updated_at DESC`,
    );
    return rows.map(mapPerson);
  }

  async createPerson(person: Person): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO persons (id, name, avatar_media_id, gender, relation_to_me, impression, birthday_calendar, birthday_year, birthday_month, birthday_day, birthday_is_leap_month, birthday_reminder_mode, birthday_reminder_enabled, birthday_reminder_hour, birthday_reminder_minute, memory_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      person.id,
      person.name,
      person.avatarMediaId,
      person.gender,
      person.relationToMe,
      person.impression,
      person.birthday?.calendar ?? null,
      person.birthday?.year ?? null,
      person.birthday?.month ?? null,
      person.birthday?.day ?? null,
      person.birthday?.isLeapMonth ? 1 : 0,
      person.birthday?.calendar ?? null,
      person.birthday?.reminderEnabled === false ? 0 : 1,
      person.birthday?.reminderHour ?? null,
      person.birthday?.reminderMinute ?? null,
      person.memoryEnabled ? 1 : 0,
      person.createdAt,
      person.updatedAt,
    );
  }

  async updatePerson(person: Person): Promise<void> {
    await this.db.runAsync(
      `UPDATE persons
       SET name = ?, avatar_media_id = ?, gender = ?, relation_to_me = ?, impression = ?,
           birthday_calendar = ?, birthday_year = ?, birthday_month = ?, birthday_day = ?, birthday_is_leap_month = ?, birthday_reminder_mode = ?,
           birthday_reminder_enabled = ?, birthday_reminder_hour = ?, birthday_reminder_minute = ?,
           memory_enabled = ?, updated_at = ?
       WHERE id = ?`,
      person.name,
      person.avatarMediaId,
      person.gender,
      person.relationToMe,
      person.impression,
      person.birthday?.calendar ?? null,
      person.birthday?.year ?? null,
      person.birthday?.month ?? null,
      person.birthday?.day ?? null,
      person.birthday?.isLeapMonth ? 1 : 0,
      person.birthday?.calendar ?? null,
      person.birthday?.reminderEnabled === false ? 0 : 1,
      person.birthday?.reminderHour ?? null,
      person.birthday?.reminderMinute ?? null,
      person.memoryEnabled ? 1 : 0,
      person.updatedAt,
      person.id,
    );
  }

  async deletePerson(personId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM persons WHERE id = ?', personId);
  }

  async setPersonMemoryEnabled(personId: string, enabled: boolean): Promise<void> {
    await this.db.runAsync(
      'UPDATE persons SET memory_enabled = ?, updated_at = ? WHERE id = ?',
      enabled ? 1 : 0,
      new Date().toISOString(),
      personId,
    );
  }

  async listTagDefinitions(): Promise<TagDefinition[]> {
    const rows = await this.db.getAllAsync<{ id: string; name: string; normalized_name: string; group_id: string | null; created_at: string; updated_at: string }>('SELECT id, name, normalized_name, group_id, created_at, updated_at FROM tag_definitions ORDER BY name COLLATE NOCASE');
    return rows.map((row) => ({ id: row.id, name: row.name, normalizedName: row.normalized_name, groupId: row.group_id, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async createTagDefinition(tag: TagDefinition): Promise<void> {
    await this.db.runAsync('INSERT INTO tag_definitions (id, name, normalized_name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', tag.id, tag.name, tag.normalizedName, tag.groupId, tag.createdAt, tag.updatedAt);
  }

  async updateTagDefinition(tag: TagDefinition): Promise<void> {
    await this.db.runAsync('UPDATE tag_definitions SET name = ?, normalized_name = ?, group_id = ?, updated_at = ? WHERE id = ?', tag.name, tag.normalizedName, tag.groupId, tag.updatedAt, tag.id);
  }

  async listTagGroups(): Promise<TagGroup[]> {
    const rows = await this.db.getAllAsync<{ id: string; name: string; created_at: string; updated_at: string }>('SELECT id, name, created_at, updated_at FROM tag_groups ORDER BY name COLLATE NOCASE');
    return rows.map((row) => ({ id: row.id, name: row.name, kind: 'group', createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async createTagGroup(group: TagGroup): Promise<void> {
    await this.db.runAsync('INSERT INTO tag_groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', group.id, group.name, group.createdAt, group.updatedAt);
  }

  async updateTagGroup(group: TagGroup): Promise<void> {
    await this.db.runAsync('UPDATE tag_groups SET name = ?, updated_at = ? WHERE id = ?', group.name, group.updatedAt, group.id);
  }

  async deleteTagGroup(groupId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync("DELETE FROM person_tag_assignments WHERE kind = 'custom' AND value IN (SELECT id FROM tag_definitions WHERE group_id = ?)", groupId);
      await transaction.runAsync('DELETE FROM tag_definitions WHERE group_id = ?', groupId);
      await transaction.runAsync('DELETE FROM tag_groups WHERE id = ?', groupId);
    });
  }

  async deleteTagDefinition(tagId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync("DELETE FROM person_tag_assignments WHERE kind = 'custom' AND value = ?", tagId);
      await transaction.runAsync('DELETE FROM tag_definitions WHERE id = ?', tagId);
    });
  }

  async countPeopleByTag(tagId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM person_tag_assignments WHERE kind = 'custom' AND value = ?", tagId);
    return row?.count ?? 0;
  }

  async listTagSystemSettings(): Promise<TagSystemSetting[]> {
    const rows = await this.db.getAllAsync<{ system: TagSystemSetting['system']; enabled: number; sort_order: number }>('SELECT system, enabled, sort_order FROM tag_system_settings ORDER BY sort_order');
    return rows.map((row) => ({ system: row.system, enabled: row.enabled === 1, sortOrder: row.sort_order }));
  }

  async updateTagSystemSettings(settings: TagSystemSetting[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      for (const setting of settings) await transaction.runAsync('UPDATE tag_system_settings SET enabled = ?, sort_order = ? WHERE system = ?', setting.enabled ? 1 : 0, setting.sortOrder, setting.system);
    });
  }

  async listPersonTagAssignments(): Promise<PersonTagAssignment[]> {
    const rows = await this.db.getAllAsync<{ person_id: string; kind: 'mbti' | 'custom'; value: string }>('SELECT person_id, kind, value FROM person_tag_assignments ORDER BY person_id, kind, value');
    return rows.map((row) => ({ personId: row.person_id, kind: row.kind, value: row.value }));
  }

  async setPersonTags(personId: string, mbti: string | null, customTagIds: string[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM person_tag_assignments WHERE person_id = ?', personId);
      if (mbti) await transaction.runAsync("INSERT INTO person_tag_assignments (person_id, kind, value) VALUES (?, 'mbti', ?)", personId, mbti);
      for (const tagId of new Set(customTagIds)) await transaction.runAsync("INSERT INTO person_tag_assignments (person_id, kind, value) VALUES (?, 'custom', ?)", personId, tagId);
    });
  }

  async listAlbums(): Promise<PersonAlbum[]> {
    const rows = await this.db.getAllAsync<{ id: string; person_id: string | null; name: string; cover_media_id: string | null; sort_order: number; created_at: string; updated_at: string }>('SELECT id, person_id, name, cover_media_id, sort_order, created_at, updated_at FROM person_albums ORDER BY person_id, sort_order, created_at');
    return rows.map((row) => ({ id: row.id, personId: row.person_id, name: row.name, coverMediaId: row.cover_media_id, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async createAlbum(album: PersonAlbum): Promise<void> {
    await this.db.runAsync('INSERT INTO person_albums (id, person_id, name, cover_media_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', album.id, album.personId, album.name, album.coverMediaId, album.sortOrder, album.createdAt, album.updatedAt);
  }

  async updateAlbum(album: PersonAlbum): Promise<void> {
    await this.db.runAsync('UPDATE person_albums SET name = ?, cover_media_id = ?, sort_order = ?, updated_at = ? WHERE id = ?', album.name, album.coverMediaId, album.sortOrder, album.updatedAt, album.id);
  }

  async deleteAlbum(albumId: string): Promise<void> {
    const rows = await this.db.getAllAsync<{ media_id: string }>('SELECT media_id FROM album_media WHERE album_id = ?', albumId);
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM person_albums WHERE id = ?', albumId);
      for (const row of rows) await transaction.runAsync('DELETE FROM media WHERE id = ?', row.media_id);
    });
  }

  async listAlbumMedia(): Promise<AlbumMedia[]> {
    const rows = await this.db.getAllAsync<{ album_id: string; media_id: string; sort_order: number; added_at: string }>('SELECT album_id, media_id, sort_order, added_at FROM album_media ORDER BY album_id, sort_order');
    return rows.map((row) => ({ albumId: row.album_id, mediaId: row.media_id, sortOrder: row.sort_order, addedAt: row.added_at }));
  }

  async addAlbumMedia(item: AlbumMedia, media: Media): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('INSERT INTO media (id, local_path, mime_type, width, height, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', media.id, media.localPath, media.mimeType, media.width, media.height, media.checksum, media.createdAt);
      await transaction.runAsync('INSERT INTO album_media (album_id, media_id, sort_order, added_at) VALUES (?, ?, ?, ?)', item.albumId, item.mediaId, item.sortOrder, item.addedAt);
    });
  }

  async updateAlbumMedia(albumId: string, items: AlbumMedia[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      for (const item of items) await transaction.runAsync('UPDATE album_media SET sort_order = ? WHERE album_id = ? AND media_id = ?', item.sortOrder, albumId, item.mediaId);
    });
  }

  async removeAlbumMedia(albumId: string, mediaId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM album_media WHERE album_id = ? AND media_id = ?', albumId, mediaId);
      await transaction.runAsync('UPDATE person_albums SET cover_media_id = NULL WHERE id = ? AND cover_media_id = ?', albumId, mediaId);
      await transaction.runAsync('DELETE FROM media WHERE id = ?', mediaId);
    });
  }

  async listBirthdayNotificationSchedules(): Promise<BirthdayNotificationSchedule[]> {
    const rows = await this.db.getAllAsync<{ id: string; person_id: string; event_type: 'advance' | 'today'; birthday_day_key: string; scheduled_at: string; platform_identifier: string }>('SELECT id, person_id, event_type, birthday_day_key, scheduled_at, platform_identifier FROM birthday_notification_schedules ORDER BY scheduled_at');
    return rows.map((row) => ({ id: row.id, personId: row.person_id, eventType: row.event_type, birthdayDayKey: row.birthday_day_key as DayKey, scheduledAt: row.scheduled_at, platformIdentifier: row.platform_identifier }));
  }

  async replaceBirthdayNotificationSchedules(items: BirthdayNotificationSchedule[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM birthday_notification_schedules');
      for (const item of items) await transaction.runAsync('INSERT INTO birthday_notification_schedules (id, person_id, event_type, birthday_day_key, scheduled_at, platform_identifier) VALUES (?, ?, ?, ?, ?, ?)', item.id, item.personId, item.eventType, item.birthdayDayKey, item.scheduledAt, item.platformIdentifier);
    });
  }

  async listMemoryNotificationSchedules(): Promise<MemoryNotificationSchedule[]> {
    const rows = await this.db.getAllAsync<{ id: string; post_id: string; scheduled_at: string; platform_identifier: string }>('SELECT id, post_id, scheduled_at, platform_identifier FROM memory_notification_schedules ORDER BY scheduled_at');
    return rows.map((row) => ({ id: row.id, postId: row.post_id, scheduledAt: row.scheduled_at, platformIdentifier: row.platform_identifier }));
  }

  async replaceMemoryNotificationSchedules(items: MemoryNotificationSchedule[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM memory_notification_schedules');
      for (const item of items) await transaction.runAsync('INSERT INTO memory_notification_schedules (id, post_id, scheduled_at, platform_identifier) VALUES (?, ?, ?, ?)', item.id, item.postId, item.scheduledAt, item.platformIdentifier);
    });
  }

  async listMemoryNotificationExposures(): Promise<MemoryNotificationExposure[]> {
    const rows = await this.db.getAllAsync<{ post_id: string; shown_at: string; review_count: number }>("SELECT post_id, shown_at, review_count FROM memory_exposures WHERE kind = 'notification'");
    return rows.map((row) => ({ postId: row.post_id, lastShownAt: row.shown_at, reviewCount: row.review_count }));
  }

  async recordMemoryNotificationExposure(postId: string, shownAt: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO memory_exposures (post_id, kind, shown_at, review_count) VALUES (?, 'notification', ?, 1)
       ON CONFLICT(post_id, kind) DO UPDATE SET
         review_count = memory_exposures.review_count + CASE WHEN excluded.shown_at > memory_exposures.shown_at THEN 1 ELSE 0 END,
         shown_at = MAX(memory_exposures.shown_at, excluded.shown_at)`,
      postId,
      shownAt,
    );
  }

  async getHomeMemory(today: DayKey): Promise<HomeMemory | null> {
    const preferences = await this.getPreferences();
    if (!preferences.globalMemoryEnabled) return null;
    const onThisDay = await this.db.getFirstAsync<PostRow>(
      `SELECT id, day_key, body_markdown, location_name, created_at, updated_at
       FROM posts
       WHERE substr(day_key, 6, 5) = substr(?, 6, 5) AND day_key < ?
       ORDER BY day_key DESC, created_at DESC
       LIMIT 1`,
      today,
      today,
    );
    if (onThisDay) return { kind: 'onThisDay', post: mapPost(onThisDay) };

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const personMemory = await this.db.getFirstAsync<PostRow & { person_id: string; person_name: string }>(
      `SELECT posts.id, posts.day_key, posts.body_markdown, posts.location_name, posts.created_at, posts.updated_at,
              persons.id AS person_id, persons.name AS person_name
       FROM posts
       INNER JOIN post_persons ON post_persons.post_id = posts.id
       INNER JOIN persons ON persons.id = post_persons.person_id
       LEFT JOIN memory_exposures ON memory_exposures.post_id = posts.id AND memory_exposures.kind = 'person'
       WHERE posts.day_key < ? AND persons.memory_enabled = 1
         AND (memory_exposures.shown_at IS NULL OR memory_exposures.shown_at < ?)
       ORDER BY posts.day_key DESC, posts.created_at DESC, persons.id
       LIMIT 1`,
      today,
      cutoff,
    );
    return personMemory ? {
      kind: 'person',
      post: mapPost(personMemory),
      person: { id: personMemory.person_id, name: personMemory.person_name },
    } : null;
  }

  async markMemoryShown(memory: HomeMemory): Promise<void> {
    if (memory.kind !== 'person') return;
    await this.db.runAsync(
      `INSERT INTO memory_exposures (post_id, kind, shown_at) VALUES (?, 'person', ?)
       ON CONFLICT(post_id, kind) DO UPDATE SET shown_at = excluded.shown_at`,
      memory.post.id,
      new Date().toISOString(),
    );
  }

  async getPreferences(): Promise<AppPreferences> {
    const rows = await this.db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return {
      onboardingCompleted: values.onboardingCompleted === 'true',
      nickname: values.nickname ?? '',
      profileBio: values.profileBio ?? '',
      profileSignature: values.profileSignature ?? '',
      profileGender: parseGender(values.profileGender),
      appearanceTheme: parseAppTheme(values.appearanceTheme),
      selfNameStyle: parseNameStyle(values.selfNameStyle, 'fresh'),
      friendNameStyle: parseNameStyle(values.friendNameStyle, 'journal'),
      birthDate: values.birthDate ?? '',
      birthDateCalendar: values.birthDateCalendar === 'lunar' ? 'lunar' : 'solar',
      birthDateIsLeapMonth: values.birthDateCalendar === 'lunar' && values.birthDateIsLeapMonth === 'true',
      profileAvatarMediaId: values.profileAvatarMediaId || null,
      profileMbti: values.profileMbti ?? '',
      profileCustomTagIds: parseStringList(values.profileCustomTagIds),
      globalMemoryEnabled: values.globalMemoryEnabled !== 'false',
      lastExportAt: values.lastExportAt || null,
      lastExportPostCount: Number(values.lastExportPostCount ?? 0),
      backupReminderShownAt: values.backupReminderShownAt || null,
      birthdayNotificationsEnabled: values.birthdayNotificationsEnabled === 'true',
      birthdayReminderHour: Number(values.birthdayReminderHour ?? 9),
      birthdayReminderMinute: Number(values.birthdayReminderMinute ?? 0),
      birthdayNotificationError: values.birthdayNotificationError || null,
      memoryNotificationsEnabled: values.memoryNotificationsEnabled === 'true',
      memoryNotificationError: values.memoryNotificationError || null,
      persistentNotificationEnabled: values.persistentNotificationEnabled === 'true',
    };
  }

  async updatePreferences(changes: Partial<AppPreferences>): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      for (const [key, rawValue] of Object.entries(changes)) {
        const value = rawValue === null ? '' : Array.isArray(rawValue) ? JSON.stringify(rawValue) : String(rawValue);
        await transaction.runAsync(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          key,
          value,
        );
      }
    });
  }

  async deleteAllData(): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync("DELETE FROM birthday_notification_schedules; DELETE FROM memory_notification_schedules; DELETE FROM album_media; DELETE FROM person_albums; DELETE FROM person_tag_assignments; DELETE FROM tag_definitions; DELETE FROM tag_groups; DELETE FROM tag_system_settings; INSERT INTO tag_system_settings (system, enabled, sort_order) VALUES ('mbti', 1, 0), ('constellation', 1, 1), ('zodiac', 1, 2), ('custom', 1, 3); DELETE FROM memory_exposures; DELETE FROM post_persons; DELETE FROM posts; DELETE FROM drafts; DELETE FROM checkins; DELETE FROM persons; DELETE FROM media; DELETE FROM settings;");
    });
  }

  async exportBackupSnapshot(): Promise<BackupSnapshot> {
    const [checkInRows, posts, draftRows, people, media, postPersonRows, settingRows, tagDefinitions, tagGroups, tagSystemSettings, personTags, albums, albumMedia] = await Promise.all([
      this.db.getAllAsync<CheckInRow>('SELECT id, day_key, city, created_at FROM checkins ORDER BY day_key'),
      this.listPosts(),
      this.db.getAllAsync<DraftRow>('SELECT id, day_key, body_markdown, updated_at FROM drafts ORDER BY day_key'),
      this.listPeople(),
      this.listMedia(),
      this.db.getAllAsync<{ post_id: string; person_id: string }>('SELECT post_id, person_id FROM post_persons ORDER BY post_id, person_id'),
      this.db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings ORDER BY key'),
      this.listTagDefinitions(),
      this.listTagGroups(),
      this.listTagSystemSettings(),
      this.listPersonTagAssignments(),
      this.listAlbums(),
      this.listAlbumMedia(),
    ]);
    return {
      checkIns: checkInRows.map(mapCheckIn),
      posts,
      drafts: draftRows.map(mapDraft),
      people,
      media,
      postPersons: postPersonRows.map((row) => ({ postId: row.post_id, personId: row.person_id })),
      settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
      tagDefinitions,
      tagGroups,
      tagSystemSettings,
      personTags,
      albums,
      albumMedia,
    };
  }

  async replaceFromBackup(snapshot: BackupSnapshot): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync('DELETE FROM birthday_notification_schedules; DELETE FROM memory_notification_schedules; DELETE FROM album_media; DELETE FROM person_albums; DELETE FROM person_tag_assignments; DELETE FROM tag_definitions; DELETE FROM tag_groups; DELETE FROM tag_system_settings; DELETE FROM memory_exposures; DELETE FROM post_persons; DELETE FROM posts; DELETE FROM drafts; DELETE FROM checkins; DELETE FROM persons; DELETE FROM media; DELETE FROM settings;');
      for (const checkIn of snapshot.checkIns) {
        await transaction.runAsync('INSERT INTO checkins (id, day_key, city, created_at) VALUES (?, ?, ?, ?)', checkIn.id, checkIn.dayKey, checkIn.city, checkIn.createdAt);
      }
      for (const person of snapshot.people) {
        await transaction.runAsync(
          'INSERT INTO persons (id, name, avatar_media_id, gender, relation_to_me, impression, birthday_calendar, birthday_year, birthday_month, birthday_day, birthday_is_leap_month, birthday_reminder_mode, birthday_reminder_enabled, birthday_reminder_hour, birthday_reminder_minute, memory_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          person.id, person.name, person.avatarMediaId, person.gender, person.relationToMe, person.impression, person.birthday?.calendar ?? null, person.birthday?.year ?? null, person.birthday?.month ?? null, person.birthday?.day ?? null, person.birthday?.isLeapMonth ? 1 : 0, person.birthday?.calendar ?? null, person.birthday?.reminderEnabled === false ? 0 : 1, person.birthday?.reminderHour ?? null, person.birthday?.reminderMinute ?? null, person.memoryEnabled ? 1 : 0, person.createdAt, person.updatedAt,
        );
      }
      for (const item of snapshot.media) {
        await transaction.runAsync(
          'INSERT INTO media (id, local_path, mime_type, width, height, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          item.id, item.localPath, item.mimeType, item.width, item.height, item.checksum, item.createdAt,
        );
      }
      for (const draft of snapshot.drafts) {
        await transaction.runAsync('INSERT INTO drafts (id, day_key, body_markdown, updated_at) VALUES (?, ?, ?, ?)', draft.id, draft.dayKey, draft.bodyMarkdown, draft.updatedAt);
      }
      for (const post of snapshot.posts) {
        await transaction.runAsync(
          'INSERT INTO posts (id, day_key, body_markdown, location_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          post.id, post.dayKey, post.bodyMarkdown, post.locationName, post.createdAt, post.updatedAt,
        );
      }
      for (const relation of snapshot.postPersons) {
        await transaction.runAsync('INSERT INTO post_persons (post_id, person_id) VALUES (?, ?)', relation.postId, relation.personId);
      }
      for (const group of snapshot.tagGroups ?? []) await transaction.runAsync('INSERT INTO tag_groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', group.id, group.name, group.createdAt, group.updatedAt);
      for (const tag of snapshot.tagDefinitions ?? []) await transaction.runAsync('INSERT INTO tag_definitions (id, name, normalized_name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', tag.id, tag.name, tag.normalizedName, tag.groupId ?? null, tag.createdAt, tag.updatedAt);
      for (const setting of snapshot.tagSystemSettings ?? defaultTagSystemSettings()) await transaction.runAsync('INSERT OR REPLACE INTO tag_system_settings (system, enabled, sort_order) VALUES (?, ?, ?)', setting.system, setting.enabled ? 1 : 0, setting.sortOrder);
      for (const relation of snapshot.personTags ?? []) await transaction.runAsync('INSERT INTO person_tag_assignments (person_id, kind, value) VALUES (?, ?, ?)', relation.personId, relation.kind, relation.value);
      for (const album of snapshot.albums ?? []) await transaction.runAsync('INSERT INTO person_albums (id, person_id, name, cover_media_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', album.id, album.personId, album.name, album.coverMediaId, album.sortOrder, album.createdAt, album.updatedAt);
      for (const relation of snapshot.albumMedia ?? []) await transaction.runAsync('INSERT INTO album_media (album_id, media_id, sort_order, added_at) VALUES (?, ?, ?, ?)', relation.albumId, relation.mediaId, relation.sortOrder, relation.addedAt);
      for (const [key, value] of Object.entries(snapshot.settings)) {
        await transaction.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', key, value);
      }
    });
  }
}

function mapCheckIn(row: CheckInRow): CheckIn {
  return { id: row.id, dayKey: row.day_key as DayKey, city: row.city, createdAt: row.created_at };
}

function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    dayKey: row.day_key as DayKey,
    bodyMarkdown: row.body_markdown,
    locationName: row.location_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    dayKey: row.day_key as DayKey,
    bodyMarkdown: row.body_markdown,
    updatedAt: row.updated_at,
  };
}

function parseStringList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseGender(value: string | undefined): Gender | null {
  return value === 'female' || value === 'male' || value === 'other' ? value : null;
}

function parseAppTheme(value: string | undefined): AppThemeId {
  return value === 'sand' || value === 'midnight' ? value : 'moss';
}

function parseNameStyle(value: string | undefined, fallback: NameStyleId): NameStyleId {
  return value === 'fresh' || value === 'journal' || value === 'sunlit' || value === 'colorful' || value === 'iridescent' ? value : fallback;
}

function mapPerson(row: PersonRow): Person {
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
      reminderMode: row.birthday_calendar,
    } : null,
    memoryEnabled: row.memory_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMedia(row: MediaRow): Media {
  return {
    id: row.id,
    localPath: row.local_path,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    checksum: row.checksum,
    createdAt: row.created_at,
  };
}

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultTagSystemSettings(): TagSystemSetting[] {
  return [
    { system: 'mbti', enabled: true, sortOrder: 0 },
    { system: 'constellation', enabled: true, sortOrder: 1 },
    { system: 'zodiac', enabled: true, sortOrder: 2 },
    { system: 'custom', enabled: true, sortOrder: 3 },
  ];
}
