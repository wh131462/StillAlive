import type { SQLiteDatabase } from 'expo-sqlite';
import { writePersistentLog } from '../platform/persistent-log';

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;
  writePersistentLog('INFO', 'database.migration.version.detected', { currentVersion });
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
      nickname TEXT,
      bio TEXT,
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

  if (currentVersion < 16) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profile_collection_requests (
      id TEXT PRIMARY KEY NOT NULL,
      person_id TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      tag_map_json TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS profile_collection_requests_expiry_idx ON profile_collection_requests(status, expires_at);
    PRAGMA user_version = 16;
  `);

  if (currentVersion < 17) {
    await addColumnIfMissing(db, 'media', 'kind', 'TEXT');
    await addColumnIfMissing(db, 'media', 'original_name', 'TEXT');
    await addColumnIfMissing(db, 'media', 'size_bytes', 'INTEGER');
    await db.execAsync(`
      UPDATE media SET kind = CASE WHEN mime_type LIKE 'audio/%' THEN 'audio' WHEN mime_type LIKE 'video/%' THEN 'video' ELSE 'image' END WHERE kind IS NULL;
      CREATE TABLE IF NOT EXISTS music_tracks (
        id TEXT PRIMARY KEY NOT NULL,
        media_id TEXT NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        artist TEXT,
        album TEXT,
        duration_ms INTEGER,
        owner_type TEXT NOT NULL,
        owner_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS music_tracks_owner_idx ON music_tracks(owner_type, owner_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY NOT NULL,
        file_media_id TEXT NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
        cover_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        author TEXT,
        format TEXT NOT NULL,
        parse_status TEXT NOT NULL,
        parse_message TEXT,
        progress REAL NOT NULL DEFAULT 0,
        location TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS books_updated_idx ON books(updated_at DESC);
      CREATE TABLE IF NOT EXISTS book_excerpts (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        location TEXT,
        note TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS book_excerpts_book_idx ON book_excerpts(book_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS reading_note_sources (
        post_id TEXT PRIMARY KEY NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        book_id TEXT,
        excerpt_ids_json TEXT NOT NULL,
        quote_snapshots_json TEXT NOT NULL
      );
      PRAGMA user_version = 17;
    `);
  }

  if (currentVersion < 18) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS music_collection_entries (
      track_id TEXT NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      PRIMARY KEY (track_id, target_type, target_id)
    );
    CREATE INDEX IF NOT EXISTS music_collection_target_idx ON music_collection_entries(target_type, target_id, created_at DESC);
    INSERT OR IGNORE INTO music_collection_entries (track_id, target_type, target_id, created_at)
    SELECT id, owner_type, CASE WHEN owner_type = 'person' THEN COALESCE(owner_id, '') ELSE '' END, created_at
    FROM music_tracks
    WHERE owner_type IN ('self', 'person') AND (owner_type != 'person' OR owner_id IS NOT NULL);
    PRAGMA user_version = 18;
  `);

  if (currentVersion < 19) {
    await addColumnIfMissing(db, 'books', 'location_type', 'TEXT');
    await addColumnIfMissing(db, 'books', 'chapter_href', 'TEXT');
    await addColumnIfMissing(db, 'books', 'chapter_title', 'TEXT');
    await addColumnIfMissing(db, 'books', 'engine_version', 'TEXT');
    await addColumnIfMissing(db, 'books', 'page_count', 'INTEGER');
    await addColumnIfMissing(db, 'book_excerpts', 'location_type', 'TEXT');
    await addColumnIfMissing(db, 'book_excerpts', 'chapter_title', 'TEXT');
    await addColumnIfMissing(db, 'book_excerpts', 'context_before', 'TEXT');
    await addColumnIfMissing(db, 'book_excerpts', 'context_after', 'TEXT');
    await addColumnIfMissing(db, 'book_excerpts', 'source_kind', 'TEXT');
    await db.execAsync(`
      UPDATE books SET location = 'pdf:' || SUBSTR(location, 6), location_type = 'pdf-page'
      WHERE format = 'pdf' AND location GLOB 'page:[0-9]*';
      UPDATE books SET location_type = 'epub-cfi'
      WHERE format = 'epub' AND location_type IS NULL AND (location LIKE 'epubcfi(%' OR chapter_href IS NOT NULL);
      UPDATE book_excerpts SET location = 'pdf:' || SUBSTR(location, 6), location_type = 'pdf-page'
      WHERE location GLOB 'page:[0-9]*';
      UPDATE book_excerpts SET source_kind = 'manual' WHERE source_kind IS NULL;
      PRAGMA user_version = 19;
    `);
  }

  if (currentVersion < 20) {
    await addColumnIfMissing(db, 'books', 'chapter_cache_json', 'TEXT');
    await db.execAsync(`
      UPDATE books SET location = 'pdf:' || SUBSTR(location, 6), location_type = 'pdf-page'
      WHERE format = 'pdf' AND location GLOB 'page:[0-9]*';
      UPDATE book_excerpts SET location = 'pdf:' || SUBSTR(location, 6), location_type = 'pdf-page'
      WHERE location GLOB 'page:[0-9]*';
      UPDATE book_excerpts SET source_kind = 'manual' WHERE source_kind IS NULL;
      UPDATE books SET parse_status = 'ready', parse_message = NULL
      WHERE format = 'epub' AND parse_status = 'unsupported';
      PRAGMA user_version = 20;
    `);
  }

  if (currentVersion < 21) await db.execAsync(`
    INSERT OR IGNORE INTO music_collection_entries (track_id, target_type, target_id, created_at)
    SELECT id, 'self', '', created_at FROM music_tracks;
    PRAGMA user_version = 21;
  `);

  if (currentVersion < 22) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS music_playlists (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS music_playlist_entries (
      playlist_id TEXT NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL,
      PRIMARY KEY (playlist_id, track_id)
    );
    CREATE INDEX IF NOT EXISTS music_playlist_entries_playlist_idx ON music_playlist_entries(playlist_id, added_at);
    PRAGMA user_version = 22;
  `);

  if (currentVersion < 23) {
    await addColumnIfMissing(db, 'music_tracks', 'cover_media_id', 'TEXT REFERENCES media(id) ON DELETE SET NULL');
    await addColumnIfMissing(db, 'music_playlists', 'cover_media_id', 'TEXT REFERENCES media(id) ON DELETE SET NULL');
    await db.execAsync('PRAGMA user_version = 23;');
  }

  if (currentVersion < 24) {
    await addColumnIfMissing(db, 'books', 'last_read_at', 'TEXT');
    await db.execAsync(`
      UPDATE books SET last_read_at = updated_at
      WHERE last_read_at IS NULL AND progress > 0;
      PRAGMA user_version = 24;
    `);
  }

  if (currentVersion < 25) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS person_books (
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (person_id, book_id)
    );
    CREATE INDEX IF NOT EXISTS person_books_person_idx ON person_books(person_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS person_books_book_idx ON person_books(book_id, person_id);
    PRAGMA user_version = 25;
  `);

  if (currentVersion < 26) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS book_lists (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS book_list_entries (
      list_id TEXT NOT NULL REFERENCES book_lists(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL,
      PRIMARY KEY (list_id, book_id)
    );
    CREATE INDEX IF NOT EXISTS book_list_entries_list_idx ON book_list_entries(list_id, added_at);
    CREATE INDEX IF NOT EXISTS book_list_entries_book_idx ON book_list_entries(book_id, list_id);
    PRAGMA user_version = 26;
  `);

  if (currentVersion < 27) await db.execAsync(`
    ALTER TABLE music_tracks ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0;
    PRAGMA user_version = 27;
  `);
  if (currentVersion < 28) {
    await addColumnIfMissing(db, 'persons', 'nickname', 'TEXT');
    await db.execAsync('PRAGMA user_version = 28;');
  }
  if (currentVersion < 29) {
    await addColumnIfMissing(db, 'persons', 'bio', 'TEXT');
    await db.execAsync('PRAGMA user_version = 29;');
  }
  if (currentVersion < 30) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS person_relationships (
      id TEXT PRIMARY KEY NOT NULL,
      source_person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      target_person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('parent', 'child', 'partner', 'sibling', 'other')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(source_person_id IS NULL OR source_person_id != target_person_id)
    );
    CREATE INDEX IF NOT EXISTS person_relationships_source_idx ON person_relationships(source_person_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS person_relationships_target_idx ON person_relationships(target_person_id, updated_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS person_relationships_pair_idx ON person_relationships(IFNULL(source_person_id, ''), target_person_id);
    PRAGMA user_version = 30;
  `);
  if (currentVersion < 31) await db.execAsync(`
    DROP INDEX IF EXISTS person_relationships_source_idx;
    DROP INDEX IF EXISTS person_relationships_target_idx;
    DROP INDEX IF EXISTS person_relationships_pair_idx;
    ALTER TABLE person_relationships RENAME TO person_relationships_v30;

    CREATE TABLE person_relationship_nodes (
      id TEXT PRIMARY KEY NOT NULL,
      node_type TEXT NOT NULL CHECK(node_type IN ('self', 'person', 'placeholder')),
      person_id TEXT UNIQUE REFERENCES persons(id) ON DELETE SET NULL,
      label TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK((node_type = 'self' AND person_id IS NULL) OR node_type != 'self'),
      CHECK((node_type = 'person' AND person_id IS NOT NULL) OR node_type != 'person')
    );
    INSERT INTO person_relationship_nodes (id, node_type, person_id, label, created_at, updated_at)
    VALUES ('self', 'self', NULL, NULL, datetime('now'), datetime('now'));
    INSERT OR IGNORE INTO person_relationship_nodes (id, node_type, person_id, label, created_at, updated_at)
    SELECT 'person_node_' || source_person_id, 'person', source_person_id, NULL, MIN(created_at), MAX(updated_at)
    FROM person_relationships_v30 WHERE source_person_id IS NOT NULL GROUP BY source_person_id;
    INSERT OR IGNORE INTO person_relationship_nodes (id, node_type, person_id, label, created_at, updated_at)
    SELECT 'person_node_' || target_person_id, 'person', target_person_id, NULL, MIN(created_at), MAX(updated_at)
    FROM person_relationships_v30 GROUP BY target_person_id;

    CREATE TABLE person_relationships (
      id TEXT PRIMARY KEY NOT NULL,
      source_node_id TEXT NOT NULL REFERENCES person_relationship_nodes(id) ON DELETE CASCADE,
      target_node_id TEXT NOT NULL REFERENCES person_relationship_nodes(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('parent', 'child', 'partner', 'sibling', 'other')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(source_node_id != target_node_id),
      UNIQUE(source_node_id, target_node_id)
    );
    INSERT INTO person_relationships (id, source_node_id, target_node_id, kind, created_at, updated_at)
    SELECT id, CASE WHEN source_person_id IS NULL THEN 'self' ELSE 'person_node_' || source_person_id END, 'person_node_' || target_person_id, kind, created_at, updated_at
    FROM person_relationships_v30;
    DROP TABLE person_relationships_v30;
    CREATE INDEX person_relationships_source_idx ON person_relationships(source_node_id, updated_at DESC);
    CREATE INDEX person_relationships_target_idx ON person_relationships(target_node_id, updated_at DESC);
    CREATE INDEX person_relationship_nodes_person_idx ON person_relationship_nodes(person_id);

    CREATE TRIGGER preserve_relationship_node_before_person_delete
    BEFORE DELETE ON persons
    BEGIN
      UPDATE person_relationship_nodes
      SET node_type = 'placeholder', label = COALESCE(NULLIF(label, ''), OLD.name), person_id = NULL, updated_at = datetime('now')
      WHERE person_id = OLD.id;
    END;
    PRAGMA user_version = 31;
  `);
  if (currentVersion < 32) {
    await addColumnIfMissing(db, 'persons', 'contacts_json', "TEXT NOT NULL DEFAULT '[]'");
    await db.execAsync('PRAGMA user_version = 32;');
  }
  const finalResult = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  writePersistentLog('INFO', 'database.migration.version.completed', { fromVersion: currentVersion, toVersion: finalResult?.user_version ?? currentVersion });
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
