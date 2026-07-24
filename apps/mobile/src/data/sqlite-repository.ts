import type { SQLiteDatabase } from 'expo-sqlite';
import type { StillAliveRepository } from '@still-alive/storage';
import type { CheckIn, DayKey, Draft, Media, Person, Post } from '@still-alive/types';

interface CheckInRow {
  id: string;
  day_key: string;
  created_at: string;
}

interface PostRow {
  id: string;
  day_key: string;
  body_markdown: string;
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
  relation_to_me: string | null;
  impression: string | null;
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
}

export interface AppPreferences {
  onboardingCompleted: boolean;
  nickname: string;
  birthDate: string;
  globalMemoryEnabled: boolean;
  lastExportAt: string | null;
  lastExportPostCount: number;
  backupReminderShownAt: string | null;
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
}

export class SQLiteStillAliveRepository implements StillAliveRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async checkIn(dayKey: DayKey): Promise<CheckIn> {
    const existing = await this.getCheckIn(dayKey);
    if (existing) return existing;

    const checkIn: CheckIn = {
      id: createLocalId('checkin'),
      dayKey,
      createdAt: new Date().toISOString(),
    };
    await this.db.runAsync(
      'INSERT INTO checkins (id, day_key, created_at) VALUES (?, ?, ?)',
      checkIn.id,
      checkIn.dayKey,
      checkIn.createdAt,
    );
    return checkIn;
  }

  async getCheckIn(dayKey: DayKey): Promise<CheckIn | null> {
    const row = await this.db.getFirstAsync<CheckInRow>(
      'SELECT id, day_key, created_at FROM checkins WHERE day_key = ?',
      dayKey,
    );
    return row ? mapCheckIn(row) : null;
  }

  async listCheckIns(): Promise<CheckIn[]> {
    const rows = await this.db.getAllAsync<CheckInRow>(
      'SELECT id, day_key, created_at FROM checkins ORDER BY day_key DESC',
    );
    return rows.map(mapCheckIn);
  }

  async createPost(post: Post, personIds: string[] = []): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        'INSERT INTO posts (id, day_key, body_markdown, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        post.id,
        post.dayKey,
        post.bodyMarkdown,
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
        'UPDATE posts SET body_markdown = ?, updated_at = ? WHERE id = ?',
        post.bodyMarkdown,
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
      'SELECT id, day_key, body_markdown, created_at, updated_at FROM posts ORDER BY day_key DESC, created_at DESC',
    );
    return rows.map(mapPost);
  }

  async listPostsByDay(dayKey: DayKey): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      'SELECT id, day_key, body_markdown, created_at, updated_at FROM posts WHERE day_key = ? ORDER BY created_at DESC',
      dayKey,
    );
    return rows.map(mapPost);
  }

  async listPostsByPerson(personId: string): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      `SELECT posts.id, posts.day_key, posts.body_markdown, posts.created_at, posts.updated_at
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

  async deleteMedia(mediaId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM media WHERE id = ?', mediaId);
  }

  async isMediaReferenced(mediaId: string): Promise<boolean> {
    const reference = `%media://${mediaId}%`;
    const row = await this.db.getFirstAsync<{ referenced: number }>(
      `SELECT EXISTS(
        SELECT 1 FROM posts WHERE body_markdown LIKE ?
        UNION ALL
        SELECT 1 FROM drafts WHERE body_markdown LIKE ?
        UNION ALL
        SELECT 1 FROM persons WHERE avatar_media_id = ?
      ) AS referenced`,
      reference,
      reference,
      mediaId,
    );
    return row?.referenced === 1;
  }

  async listPeople(): Promise<Person[]> {
    const rows = await this.db.getAllAsync<PersonRow>(
      `SELECT id, name, avatar_media_id, relation_to_me, impression, memory_enabled, created_at, updated_at
       FROM persons ORDER BY updated_at DESC`,
    );
    return rows.map(mapPerson);
  }

  async createPerson(person: Person): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO persons (id, name, avatar_media_id, relation_to_me, impression, memory_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      person.id,
      person.name,
      person.avatarMediaId,
      person.relationToMe,
      person.impression,
      person.memoryEnabled ? 1 : 0,
      person.createdAt,
      person.updatedAt,
    );
  }

  async updatePerson(person: Person): Promise<void> {
    await this.db.runAsync(
      `UPDATE persons
       SET name = ?, avatar_media_id = ?, relation_to_me = ?, impression = ?, memory_enabled = ?, updated_at = ?
       WHERE id = ?`,
      person.name,
      person.avatarMediaId,
      person.relationToMe,
      person.impression,
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

  async getHomeMemory(today: DayKey): Promise<HomeMemory | null> {
    const preferences = await this.getPreferences();
    if (!preferences.globalMemoryEnabled) return null;
    const onThisDay = await this.db.getFirstAsync<PostRow>(
      `SELECT id, day_key, body_markdown, created_at, updated_at
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
      `SELECT posts.id, posts.day_key, posts.body_markdown, posts.created_at, posts.updated_at,
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
      birthDate: values.birthDate ?? '',
      globalMemoryEnabled: values.globalMemoryEnabled !== 'false',
      lastExportAt: values.lastExportAt || null,
      lastExportPostCount: Number(values.lastExportPostCount ?? 0),
      backupReminderShownAt: values.backupReminderShownAt || null,
    };
  }

  async updatePreferences(changes: Partial<AppPreferences>): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      for (const [key, rawValue] of Object.entries(changes)) {
        const value = rawValue === null ? '' : String(rawValue);
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
      await transaction.execAsync('DELETE FROM memory_exposures; DELETE FROM post_persons; DELETE FROM posts; DELETE FROM drafts; DELETE FROM checkins; DELETE FROM persons; DELETE FROM media; DELETE FROM settings;');
    });
  }

  async exportBackupSnapshot(): Promise<BackupSnapshot> {
    const [checkInRows, posts, draftRows, people, media, postPersonRows, settingRows] = await Promise.all([
      this.db.getAllAsync<CheckInRow>('SELECT id, day_key, created_at FROM checkins ORDER BY day_key'),
      this.listPosts(),
      this.db.getAllAsync<DraftRow>('SELECT id, day_key, body_markdown, updated_at FROM drafts ORDER BY day_key'),
      this.listPeople(),
      this.listMedia(),
      this.db.getAllAsync<{ post_id: string; person_id: string }>('SELECT post_id, person_id FROM post_persons ORDER BY post_id, person_id'),
      this.db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings ORDER BY key'),
    ]);
    return {
      checkIns: checkInRows.map(mapCheckIn),
      posts,
      drafts: draftRows.map(mapDraft),
      people,
      media,
      postPersons: postPersonRows.map((row) => ({ postId: row.post_id, personId: row.person_id })),
      settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
    };
  }

  async replaceFromBackup(snapshot: BackupSnapshot): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync('DELETE FROM memory_exposures; DELETE FROM post_persons; DELETE FROM posts; DELETE FROM drafts; DELETE FROM checkins; DELETE FROM persons; DELETE FROM media; DELETE FROM settings;');
      for (const checkIn of snapshot.checkIns) {
        await transaction.runAsync('INSERT INTO checkins (id, day_key, created_at) VALUES (?, ?, ?)', checkIn.id, checkIn.dayKey, checkIn.createdAt);
      }
      for (const person of snapshot.people) {
        await transaction.runAsync(
          'INSERT INTO persons (id, name, avatar_media_id, relation_to_me, impression, memory_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          person.id, person.name, person.avatarMediaId, person.relationToMe, person.impression, person.memoryEnabled ? 1 : 0, person.createdAt, person.updatedAt,
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
          'INSERT INTO posts (id, day_key, body_markdown, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          post.id, post.dayKey, post.bodyMarkdown, post.createdAt, post.updatedAt,
        );
      }
      for (const relation of snapshot.postPersons) {
        await transaction.runAsync('INSERT INTO post_persons (post_id, person_id) VALUES (?, ?)', relation.postId, relation.personId);
      }
      for (const [key, value] of Object.entries(snapshot.settings)) {
        await transaction.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', key, value);
      }
    });
  }
}

function mapCheckIn(row: CheckInRow): CheckIn {
  return { id: row.id, dayKey: row.day_key as DayKey, createdAt: row.created_at };
}

function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    dayKey: row.day_key as DayKey,
    bodyMarkdown: row.body_markdown,
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

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    avatarMediaId: row.avatar_media_id,
    relationToMe: row.relation_to_me,
    impression: row.impression,
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
