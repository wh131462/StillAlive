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
  if (currentVersion < 33) {
    await addColumnIfMissing(db, 'persons', 'custom_fields_json', "TEXT NOT NULL DEFAULT '{}'");
    await addColumnIfMissing(db, 'persons', 'important_dates_json', "TEXT NOT NULL DEFAULT '[]'");
    await addColumnIfMissing(db, 'persons', 'privacy_mode', "TEXT NOT NULL DEFAULT 'normal'");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS person_events (
        id TEXT PRIMARY KEY NOT NULL,
        person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        time_text TEXT,
        participant_ids_json TEXT NOT NULL DEFAULT '[]',
        pinned INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS person_events_person_idx ON person_events(person_id, pinned DESC, sort_order, created_at DESC);
      PRAGMA user_version = 33;
    `);
  }
  if (currentVersion < 34) {
    await addColumnIfMissing(db, 'music_tracks', 'quality', 'TEXT');
    await db.execAsync('PRAGMA user_version = 34;');
  }
  if (currentVersion < 35) {
    await addColumnIfMissing(db, 'posts', 'comments_json', "TEXT NOT NULL DEFAULT '[]'");
    await db.execAsync('PRAGMA user_version = 35;');
  }
  if (currentVersion < 36) {
    await addColumnIfMissing(db, 'posts', 'pinned', 'INTEGER NOT NULL DEFAULT 0');
    await db.execAsync('CREATE INDEX IF NOT EXISTS posts_pinned_idx ON posts(pinned DESC, day_key DESC, created_at DESC); PRAGMA user_version = 36;');
  }
  if (currentVersion < 37) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
      category TEXT NOT NULL,
      day_key TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ledger_transactions_day_idx ON ledger_transactions(day_key DESC, created_at DESC);
    PRAGMA user_version = 37;
  `);
  if (currentVersion < 38) {
    await addColumnIfMissing(db, 'birthday_notification_schedules', 'important_date_id', 'TEXT');
    await db.execAsync('PRAGMA user_version = 38;');
  }
  if (currentVersion < 39) {
    const hasBookExcerpts = await tableExists(db, 'book_excerpts');
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      if (hasBookExcerpts) {
        await db.execAsync(`
          DROP TABLE IF EXISTS book_excerpts_v38;
          ALTER TABLE book_excerpts RENAME TO book_excerpts_v38;
          CREATE TABLE book_excerpts (
            id TEXT PRIMARY KEY NOT NULL,
            book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
            book_title TEXT,
            text TEXT NOT NULL,
            location TEXT,
            note TEXT,
            location_type TEXT,
            chapter_title TEXT,
            context_before TEXT,
            context_after TEXT,
            source_kind TEXT,
            created_at TEXT NOT NULL
          );
          INSERT INTO book_excerpts (id, book_id, book_title, text, location, note, location_type, chapter_title, context_before, context_after, source_kind, created_at)
          SELECT e.id, e.book_id, b.title, e.text, e.location, e.note, e.location_type, e.chapter_title, e.context_before, e.context_after, e.source_kind, e.created_at
          FROM book_excerpts_v38 e
          LEFT JOIN books b ON b.id = e.book_id;
          DROP TABLE book_excerpts_v38;
          CREATE INDEX IF NOT EXISTS book_excerpts_book_idx ON book_excerpts(book_id, created_at DESC);
          PRAGMA user_version = 39;
        `);
      } else {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS book_excerpts (
            id TEXT PRIMARY KEY NOT NULL,
            book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
            book_title TEXT,
            text TEXT NOT NULL,
            location TEXT,
            note TEXT,
            location_type TEXT,
            chapter_title TEXT,
            context_before TEXT,
            context_after TEXT,
            source_kind TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS book_excerpts_book_idx ON book_excerpts(book_id, created_at DESC);
          PRAGMA user_version = 39;
        `);
      }
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON;');
    }
  }
  if (currentVersion < 40) {
    await addColumnIfMissing(db, 'profile_collection_requests', 'invitation_url', 'TEXT');
    await db.execAsync('PRAGMA user_version = 40;');
  }
  if (currentVersion < 41) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ai_provider_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('openai-compatible', 'anthropic', 'deepseek')),
      base_url TEXT NOT NULL,
      model_id TEXT NOT NULL DEFAULT '',
      key_hint TEXT NOT NULL DEFAULT '',
      supports_stream INTEGER NOT NULL DEFAULT 1,
      supports_balance INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      last_probe_at TEXT,
      last_probe_status TEXT,
      last_probe_latency_ms INTEGER,
      last_probe_message TEXT,
      models_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_profiles_default_idx ON ai_provider_profiles(is_default) WHERE is_default = 1;

    CREATE TABLE IF NOT EXISTS ai_usage_records (
      id TEXT PRIMARY KEY NOT NULL,
      provider_id TEXT NOT NULL,
      provider_kind TEXT NOT NULL,
      model_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'cancelled')),
      error_code TEXT,
      input_tokens INTEGER,
      cached_input_tokens INTEGER,
      output_tokens INTEGER,
      duration_ms INTEGER NOT NULL,
      estimated_cost_micros INTEGER,
      currency TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_usage_records_created_idx ON ai_usage_records(created_at DESC);
    CREATE INDEX IF NOT EXISTS ai_usage_records_provider_idx ON ai_usage_records(provider_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ai_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    PRAGMA user_version = 41;
  `);
  if (currentVersion < 42) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS knowledge_sources (
      source_kind TEXT NOT NULL,
      source_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      chunk_count INTEGER NOT NULL,
      indexed_at TEXT NOT NULL,
      PRIMARY KEY (source_kind, source_id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY NOT NULL,
      source_kind TEXT NOT NULL,
      source_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      day_key TEXT,
      person_ids_json TEXT,
      tag_keys_json TEXT,
      title TEXT,
      context_prefix TEXT NOT NULL,
      body_text TEXT NOT NULL,
      char_start INTEGER NOT NULL DEFAULT 0,
      char_end INTEGER NOT NULL DEFAULT 0,
      is_private INTEGER NOT NULL DEFAULT 0,
      token_estimate INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      source_updated_at TEXT,
      indexed_at TEXT NOT NULL,
      UNIQUE(source_kind, source_id, chunk_index)
    );
    CREATE INDEX IF NOT EXISTS knowledge_chunks_day_idx ON knowledge_chunks(day_key DESC);
    CREATE INDEX IF NOT EXISTS knowledge_chunks_source_idx ON knowledge_chunks(source_kind, source_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
      context_prefix,
      body_text,
      title,
      content='knowledge_chunks',
      content_rowid='rowid',
      tokenize='trigram'
    );
    CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ai AFTER INSERT ON knowledge_chunks BEGIN
      INSERT INTO knowledge_chunks_fts(rowid, context_prefix, body_text, title)
        VALUES (new.rowid, new.context_prefix, new.body_text, new.title);
    END;
    CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ad AFTER DELETE ON knowledge_chunks BEGIN
      INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, context_prefix, body_text, title)
        VALUES ('delete', old.rowid, old.context_prefix, old.body_text, old.title);
    END;
    CREATE TRIGGER IF NOT EXISTS knowledge_chunks_au AFTER UPDATE ON knowledge_chunks BEGIN
      INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, context_prefix, body_text, title)
        VALUES ('delete', old.rowid, old.context_prefix, old.body_text, old.title);
      INSERT INTO knowledge_chunks_fts(rowid, context_prefix, body_text, title)
        VALUES (new.rowid, new.context_prefix, new.body_text, new.title);
    END;

    CREATE TABLE IF NOT EXISTS knowledge_aggregates (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      title TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      stats_json TEXT,
      source_refs_json TEXT NOT NULL,
      generator TEXT NOT NULL DEFAULT 'deterministic',
      model_id TEXT,
      source_revision TEXT NOT NULL,
      stale INTEGER NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(kind, scope_key, generator)
    );
    CREATE INDEX IF NOT EXISTS knowledge_aggregates_lookup_idx ON knowledge_aggregates(kind, scope_key, stale);

    CREATE TABLE IF NOT EXISTS knowledge_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_items (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('semantic', 'episodic', 'procedural')),
      subject_type TEXT NOT NULL CHECK(subject_type IN ('self', 'person', 'topic')),
      subject_id TEXT,
      content TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      importance INTEGER NOT NULL DEFAULT 2 CHECK(importance BETWEEN 1 AND 3),
      status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'archived', 'suppressed', 'deleted')),
      origin TEXT NOT NULL CHECK(origin IN ('user', 'derived', 'ai_auto')),
      valid_from TEXT,
      valid_to TEXT,
      recorded_at TEXT NOT NULL,
      last_confirmed_at TEXT,
      extraction_batch_id TEXT,
      last_used_at TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS memory_items_status_idx ON memory_items(status, subject_type, subject_id);
    CREATE INDEX IF NOT EXISTS memory_items_batch_idx ON memory_items(extraction_batch_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS memory_items_fts USING fts5(
      content,
      content='memory_items',
      content_rowid='rowid',
      tokenize='trigram'
    );
    CREATE TRIGGER IF NOT EXISTS memory_items_ai AFTER INSERT ON memory_items BEGIN
      INSERT INTO memory_items_fts(rowid, content) VALUES (new.rowid, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS memory_items_ad AFTER DELETE ON memory_items BEGIN
      INSERT INTO memory_items_fts(memory_items_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS memory_items_au AFTER UPDATE ON memory_items BEGIN
      INSERT INTO memory_items_fts(memory_items_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
      INSERT INTO memory_items_fts(rowid, content) VALUES (new.rowid, new.content);
    END;

    CREATE TABLE IF NOT EXISTS memory_sources (
      memory_id TEXT NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
      source_kind TEXT NOT NULL,
      source_id TEXT NOT NULL,
      PRIMARY KEY (memory_id, source_kind, source_id)
    );

    CREATE TABLE IF NOT EXISTS memory_revisions (
      id TEXT PRIMARY KEY NOT NULL,
      memory_id TEXT NOT NULL,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS memory_revisions_memory_idx ON memory_revisions(memory_id, created_at DESC);

    PRAGMA user_version = 42;
  `);
  if (currentVersion < 43) await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS ai_conversations_updated_idx ON ai_conversations(updated_at DESC);

    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      text TEXT NOT NULL,
      question TEXT NOT NULL DEFAULT '',
      failed INTEGER NOT NULL DEFAULT 0,
      memory_count INTEGER NOT NULL DEFAULT 0,
      sources_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_chat_messages_conversation_idx ON ai_chat_messages(conversation_id, created_at ASC);

    PRAGMA user_version = 43;
  `);
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
