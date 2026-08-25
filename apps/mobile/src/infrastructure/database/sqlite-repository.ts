import type { SQLiteDatabase } from 'expo-sqlite';
import type { StillAliveRepository } from './repository-contract';
import type { AlbumMedia, AppThemeId, BirthdayCalendar, BirthdayNotificationSchedule, BirthdayReminderMode, Book, BookExcerpt, BookFormat, BookList, BookListEntry, BookLocationType, BookParseStatus, CheckIn, DayKey, Draft, Gender, Media, MusicCollectionEntry, MusicCollectionTargetType, MusicPlaybackMode, MusicPlaylist, MusicPlaylistEntry, MusicTrack, NameStyleId, Person, PersonAlbum, PersonBook, PersonTagAssignment, Post, ProfileCollectionField, ProfileCollectionRequest, ProfileCollectionRequestStatus, ReaderTocItem, ReadingNoteSource, TagDefinition, TagGroup, TagSystemSetting } from '@still-alive/types';
import type { MemoryNotificationExposure, MemoryNotificationSchedule } from '../../features/home/memory-notifications';
import type { AppPreferences, BackupSnapshot, BookExcerptRow, BookListEntryRow, BookListRow, BookRow, CheckInRow, DraftRow, HomeMemory, MediaRow, MusicCollectionEntryRow, MusicPlaylistEntryRow, MusicPlaylistRow, MusicTrackRow, PersonBookRow, PersonRow, PostRow, ProfileCollectionRequestRow } from './database-models';
import { createLocalId, defaultTagSystemSettings, mapBook, mapBookExcerpt, mapCheckIn, mapDraft, mapMedia, mapMusicTrack, mapPerson, mapPost, mapProfileCollectionRequest, parseAppTheme, parseGender, parseNameStyle, parseQuoteSnapshots, parseStringList } from './sqlite-mappers';

function mediaKindForMimeType(mimeType: string): 'image' | 'video' | 'audio' {
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'image';
}

export class SQLiteStillAliveRepository implements StillAliveRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly db: SQLiteDatabase) {}

  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.writeQueue.catch(() => undefined).then(operation);
    this.writeQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  private withTransaction<T>(operation: (transaction: SQLiteDatabase) => Promise<T>): Promise<T> {
    return this.enqueueWrite(async () => {
      let result: T;
      await this.db.withTransactionAsync(async () => { result = await operation(this.db); });
      return result!;
    });
  }

  async checkIn(dayKey: DayKey): Promise<CheckIn> {
    const existing = await this.getCheckIn(dayKey);
    if (existing) return existing;

    const checkIn: CheckIn = {
      id: createLocalId('checkin'),
      dayKey,
      city: null,
      createdAt: new Date().toISOString(),
    };
    await this.enqueueWrite(() => this.db.runAsync(
      'INSERT INTO checkins (id, day_key, city, created_at) VALUES (?, ?, ?, ?)',
      checkIn.id,
      checkIn.dayKey,
      checkIn.city,
      checkIn.createdAt,
    ));
    return checkIn;
  }

  async updateCheckInCity(checkInId: string, city: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      'UPDATE checkins SET city = ? WHERE id = ?',
      city,
      checkInId,
    ));
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
    await this.withTransaction(async (transaction) => {
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
    await this.withTransaction(async (transaction) => {
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
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM posts WHERE id = ?', postId));
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
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO drafts (id, day_key, body_markdown, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(day_key) DO UPDATE SET body_markdown = excluded.body_markdown, updated_at = excluded.updated_at`,
      draft.id,
      draft.dayKey,
      draft.bodyMarkdown,
      draft.updatedAt,
    ));
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
      'SELECT id, local_path, mime_type, width, height, checksum, created_at, kind, original_name, size_bytes FROM media ORDER BY created_at DESC',
    );
    return rows.map(mapMedia);
  }

  async createMedia(media: Media): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      'INSERT INTO media (id, local_path, mime_type, width, height, checksum, created_at, kind, original_name, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      media.id,
      media.localPath,
      media.mimeType,
      media.width,
      media.height,
      media.checksum,
      media.createdAt,
      media.kind ?? mediaKindForMimeType(media.mimeType),
      media.originalName ?? null,
      media.sizeBytes ?? null,
    ));
  }

  async updateMedia(media: Media): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      'UPDATE media SET local_path = ?, mime_type = ?, width = ?, height = ?, checksum = ?, created_at = ?, kind = ?, original_name = ?, size_bytes = ? WHERE id = ?',
      media.localPath,
      media.mimeType,
      media.width,
      media.height,
      media.checksum,
      media.createdAt,
      media.kind ?? mediaKindForMimeType(media.mimeType),
      media.originalName ?? null,
      media.sizeBytes ?? null,
      media.id,
    ));
  }

  async deleteMedia(mediaId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM media WHERE id = ?', mediaId));
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
        SELECT 1 FROM music_tracks WHERE media_id = ?
        UNION ALL
        SELECT 1 FROM music_tracks WHERE cover_media_id = ?
        UNION ALL
        SELECT 1 FROM music_playlists WHERE cover_media_id = ?
        UNION ALL
        SELECT 1 FROM books WHERE file_media_id = ? OR cover_media_id = ?
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
      mediaId,
      mediaId,
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
    await this.enqueueWrite(() => this.db.runAsync(
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
    ));
  }

  async updatePerson(person: Person): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
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
    ));
  }

  async deletePerson(personId: string): Promise<string[]> {
    return this.withTransaction(async (transaction) => {
      const musicRows = await transaction.getAllAsync<{ track_id: string }>("SELECT track_id FROM music_collection_entries WHERE target_type = 'person' AND target_id = ?", personId);
      await transaction.runAsync("DELETE FROM music_collection_entries WHERE target_type = 'person' AND target_id = ?", personId);
      await transaction.runAsync('DELETE FROM persons WHERE id = ?', personId);
      const deletedTrackIds: string[] = [];
      for (const { track_id: trackId } of musicRows) {
        const remaining = await transaction.getFirstAsync<{ present: number }>('SELECT 1 AS present FROM music_collection_entries WHERE track_id = ? LIMIT 1', trackId);
        if (!remaining) {
          await transaction.runAsync('DELETE FROM music_tracks WHERE id = ?', trackId);
          deletedTrackIds.push(trackId);
        }
      }
      return deletedTrackIds;
    });
  }

  async setPersonMemoryEnabled(personId: string, enabled: boolean): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      'UPDATE persons SET memory_enabled = ?, updated_at = ? WHERE id = ?',
      enabled ? 1 : 0,
      new Date().toISOString(),
      personId,
    ));
  }

  async listPersonBooks(): Promise<PersonBook[]> {
    const rows = await this.db.getAllAsync<PersonBookRow>('SELECT person_id, book_id, created_at FROM person_books ORDER BY created_at DESC');
    return rows.map((row) => ({ personId: row.person_id, bookId: row.book_id, createdAt: row.created_at }));
  }

  async setPersonBooks(personId: string, bookIds: string[]): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM person_books WHERE person_id = ?', personId);
      const createdAt = new Date().toISOString();
      for (const bookId of new Set(bookIds)) {
        await transaction.runAsync('INSERT INTO person_books (person_id, book_id, created_at) VALUES (?, ?, ?)', personId, bookId, createdAt);
      }
    });
  }

  async listTagDefinitions(): Promise<TagDefinition[]> {
    const rows = await this.db.getAllAsync<{ id: string; name: string; normalized_name: string; group_id: string | null; created_at: string; updated_at: string }>('SELECT id, name, normalized_name, group_id, created_at, updated_at FROM tag_definitions ORDER BY name COLLATE NOCASE');
    return rows.map((row) => ({ id: row.id, name: row.name, normalizedName: row.normalized_name, groupId: row.group_id, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async createTagDefinition(tag: TagDefinition): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO tag_definitions (id, name, normalized_name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', tag.id, tag.name, tag.normalizedName, tag.groupId, tag.createdAt, tag.updatedAt));
  }

  async updateTagDefinition(tag: TagDefinition): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE tag_definitions SET name = ?, normalized_name = ?, group_id = ?, updated_at = ? WHERE id = ?', tag.name, tag.normalizedName, tag.groupId, tag.updatedAt, tag.id));
  }

  async listTagGroups(): Promise<TagGroup[]> {
    const rows = await this.db.getAllAsync<{ id: string; name: string; created_at: string; updated_at: string }>('SELECT id, name, created_at, updated_at FROM tag_groups ORDER BY name COLLATE NOCASE');
    return rows.map((row) => ({ id: row.id, name: row.name, kind: 'group', createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async createTagGroup(group: TagGroup): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO tag_groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', group.id, group.name, group.createdAt, group.updatedAt));
  }

  async updateTagGroup(group: TagGroup): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE tag_groups SET name = ?, updated_at = ? WHERE id = ?', group.name, group.updatedAt, group.id));
  }

  async deleteTagGroup(groupId: string): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync("DELETE FROM person_tag_assignments WHERE kind = 'custom' AND value IN (SELECT id FROM tag_definitions WHERE group_id = ?)", groupId);
      await transaction.runAsync('DELETE FROM tag_definitions WHERE group_id = ?', groupId);
      await transaction.runAsync('DELETE FROM tag_groups WHERE id = ?', groupId);
    });
  }

  async deleteTagDefinition(tagId: string): Promise<void> {
    await this.withTransaction(async (transaction) => {
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
    await this.withTransaction(async (transaction) => {
      for (const setting of settings) await transaction.runAsync('UPDATE tag_system_settings SET enabled = ?, sort_order = ? WHERE system = ?', setting.enabled ? 1 : 0, setting.sortOrder, setting.system);
    });
  }

  async listPersonTagAssignments(): Promise<PersonTagAssignment[]> {
    const rows = await this.db.getAllAsync<{ person_id: string; kind: 'mbti' | 'custom'; value: string }>('SELECT person_id, kind, value FROM person_tag_assignments ORDER BY person_id, kind, value');
    return rows.map((row) => ({ personId: row.person_id, kind: row.kind, value: row.value }));
  }

  async setPersonTags(personId: string, mbti: string | null, customTagIds: string[]): Promise<void> {
    await this.withTransaction(async (transaction) => {
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
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO person_albums (id, person_id, name, cover_media_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', album.id, album.personId, album.name, album.coverMediaId, album.sortOrder, album.createdAt, album.updatedAt));
  }

  async updateAlbum(album: PersonAlbum): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE person_albums SET name = ?, cover_media_id = ?, sort_order = ?, updated_at = ? WHERE id = ?', album.name, album.coverMediaId, album.sortOrder, album.updatedAt, album.id));
  }

  async deleteAlbum(albumId: string): Promise<void> {
    const rows = await this.db.getAllAsync<{ media_id: string }>('SELECT media_id FROM album_media WHERE album_id = ?', albumId);
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM person_albums WHERE id = ?', albumId);
      for (const row of rows) await transaction.runAsync('DELETE FROM media WHERE id = ?', row.media_id);
    });
  }

  async listAlbumMedia(): Promise<AlbumMedia[]> {
    const rows = await this.db.getAllAsync<{ album_id: string; media_id: string; sort_order: number; added_at: string }>('SELECT album_id, media_id, sort_order, added_at FROM album_media ORDER BY album_id, sort_order');
    return rows.map((row) => ({ albumId: row.album_id, mediaId: row.media_id, sortOrder: row.sort_order, addedAt: row.added_at }));
  }

  async addAlbumMedia(item: AlbumMedia, media: Media): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('INSERT INTO media (id, local_path, mime_type, width, height, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', media.id, media.localPath, media.mimeType, media.width, media.height, media.checksum, media.createdAt);
      await transaction.runAsync('INSERT INTO album_media (album_id, media_id, sort_order, added_at) VALUES (?, ?, ?, ?)', item.albumId, item.mediaId, item.sortOrder, item.addedAt);
    });
  }

  async updateAlbumMedia(albumId: string, items: AlbumMedia[]): Promise<void> {
    await this.withTransaction(async (transaction) => {
      for (const item of items) await transaction.runAsync('UPDATE album_media SET sort_order = ? WHERE album_id = ? AND media_id = ?', item.sortOrder, albumId, item.mediaId);
    });
  }

  async removeAlbumMedia(albumId: string, mediaId: string): Promise<void> {
    await this.withTransaction(async (transaction) => {
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
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM birthday_notification_schedules');
      for (const item of items) await transaction.runAsync('INSERT INTO birthday_notification_schedules (id, person_id, event_type, birthday_day_key, scheduled_at, platform_identifier) VALUES (?, ?, ?, ?, ?, ?)', item.id, item.personId, item.eventType, item.birthdayDayKey, item.scheduledAt, item.platformIdentifier);
    });
  }

  async createProfileCollectionRequest(request: ProfileCollectionRequest): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO profile_collection_requests
       (id, person_id, fields_json, tag_map_json, expires_at, status, created_at, consumed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      request.id,
      request.personId,
      JSON.stringify(request.fields),
      JSON.stringify(request.tagMap),
      request.expiresAt,
      request.status,
      request.createdAt,
      request.consumedAt,
    ));
  }

  async getProfileCollectionRequest(requestId: string): Promise<ProfileCollectionRequest | null> {
    const row = await this.db.getFirstAsync<ProfileCollectionRequestRow>(
      `SELECT id, person_id, fields_json, tag_map_json, expires_at, status, created_at, consumed_at
       FROM profile_collection_requests WHERE id = ?`,
      requestId,
    );
    return row ? mapProfileCollectionRequest(row) : null;
  }

  async listProfileCollectionRequestIds(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ id: string }>('SELECT id FROM profile_collection_requests ORDER BY created_at');
    return rows.map((row) => row.id);
  }

  async consumeProfileCollectionRequest(requestId: string, consumedAt: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      "UPDATE profile_collection_requests SET status = 'consumed', consumed_at = ? WHERE id = ? AND status = 'pending'",
      consumedAt,
      requestId,
    ));
  }

  async deleteProfileCollectionRequest(requestId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM profile_collection_requests WHERE id = ?', requestId));
  }

  async deleteExpiredProfileCollectionRequests(now: string): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ id: string }>(
      "SELECT id FROM profile_collection_requests WHERE status = 'pending' AND expires_at <= ?",
      now,
    );
    if (rows.length) await this.enqueueWrite(() => this.db.runAsync(
      "DELETE FROM profile_collection_requests WHERE status = 'pending' AND expires_at <= ?",
      now,
    ));
    return rows.map((row) => row.id);
  }

  async applyProfileCollectionUpdate(requestId: string, person: Person, mbti: string | null, customTagIds: string[], newTags: TagDefinition[], consumedAt: string): Promise<void> {
    await this.withTransaction(async (transaction) => {
      const consumed = await transaction.runAsync(
        "UPDATE profile_collection_requests SET status = 'consumed', consumed_at = ? WHERE id = ? AND person_id = ? AND status = 'pending' AND expires_at > ?",
        consumedAt,
        requestId,
        person.id,
        consumedAt,
      );
      if (consumed.changes !== 1) throw new Error('这份资料邀请已经过期或使用过');
      const updated = await transaction.runAsync(
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
        person.birthday?.reminderMode ?? null,
        person.birthday?.reminderEnabled === false ? 0 : 1,
        person.birthday?.reminderHour ?? null,
        person.birthday?.reminderMinute ?? null,
        person.memoryEnabled ? 1 : 0,
        person.updatedAt,
        person.id,
      );
      if (updated.changes !== 1) throw new Error('对应的人物已经被删除');
      for (const tag of newTags) await transaction.runAsync('INSERT INTO tag_definitions (id, name, normalized_name, group_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)', tag.id, tag.name, tag.normalizedName, tag.createdAt, tag.updatedAt);
      await transaction.runAsync('DELETE FROM person_tag_assignments WHERE person_id = ?', person.id);
      if (mbti) await transaction.runAsync("INSERT INTO person_tag_assignments (person_id, kind, value) VALUES (?, 'mbti', ?)", person.id, mbti);
      for (const tagId of new Set(customTagIds)) await transaction.runAsync("INSERT INTO person_tag_assignments (person_id, kind, value) VALUES (?, 'custom', ?)", person.id, tagId);
    });
  }

  async listMusicTracks(): Promise<MusicTrack[]> {
    const rows = await this.db.getAllAsync<MusicTrackRow>('SELECT id, media_id, cover_media_id, title, artist, album, duration_ms, play_count, created_at, updated_at FROM music_tracks ORDER BY created_at DESC');
    return rows.map(mapMusicTrack);
  }

  async importMusicTrack(media: Media, track: MusicTrack, collections: MusicCollectionEntry[], coverMedia: Media | null = null): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync(
        'INSERT INTO media (id, local_path, mime_type, width, height, checksum, created_at, kind, original_name, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        media.id, media.localPath, media.mimeType, media.width, media.height, media.checksum, media.createdAt, media.kind ?? 'audio', media.originalName ?? null, media.sizeBytes ?? null,
      );
      if (coverMedia) await transaction.runAsync(
        'INSERT INTO media (id, local_path, mime_type, width, height, checksum, created_at, kind, original_name, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        coverMedia.id, coverMedia.localPath, coverMedia.mimeType, coverMedia.width, coverMedia.height, coverMedia.checksum, coverMedia.createdAt, coverMedia.kind ?? 'image', coverMedia.originalName ?? null, coverMedia.sizeBytes ?? null,
      );
      await transaction.runAsync('INSERT INTO music_tracks (id, media_id, cover_media_id, title, artist, album, duration_ms, play_count, owner_type, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)', track.id, track.mediaId, track.coverMediaId ?? null, track.title, track.artist, track.album, track.durationMs, track.playCount, 'unassigned', track.createdAt, track.updatedAt);
      for (const collection of collections) await transaction.runAsync('INSERT INTO music_collection_entries (track_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)', collection.trackId, collection.targetType, collection.targetId ?? '', collection.createdAt);
    });
  }

  async createMusicTrack(track: MusicTrack, collection?: MusicCollectionEntry): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('INSERT INTO music_tracks (id, media_id, cover_media_id, title, artist, album, duration_ms, play_count, owner_type, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)', track.id, track.mediaId, track.coverMediaId ?? null, track.title, track.artist, track.album, track.durationMs, track.playCount, 'unassigned', track.createdAt, track.updatedAt);
      if (collection) await transaction.runAsync('INSERT INTO music_collection_entries (track_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)', collection.trackId, collection.targetType, collection.targetId ?? '', collection.createdAt);
    });
  }

  async updateMusicTrack(track: MusicTrack): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE music_tracks SET cover_media_id = ?, title = ?, artist = ?, album = ?, duration_ms = ?, updated_at = ? WHERE id = ?', track.coverMediaId, track.title, track.artist, track.album, track.durationMs, track.updatedAt, track.id));
  }

  async incrementMusicTrackPlayCount(trackId: string): Promise<void> {
    const result = await this.enqueueWrite(() => this.db.runAsync('UPDATE music_tracks SET play_count = play_count + 1 WHERE id = ?', trackId));
    if (result.changes !== 1) throw new Error('歌曲不存在或已删除');
  }

  async deleteMusicTrack(trackId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM music_tracks WHERE id = ?', trackId));
  }

  async listMusicCollectionEntries(): Promise<MusicCollectionEntry[]> {
    const rows = await this.db.getAllAsync<MusicCollectionEntryRow>('SELECT track_id, target_type, target_id, created_at FROM music_collection_entries ORDER BY created_at DESC');
    return rows.map((row) => ({ trackId: row.track_id, targetType: row.target_type, targetId: row.target_type === 'person' ? row.target_id : null, createdAt: row.created_at }));
  }

  async addMusicCollectionEntry(entry: MusicCollectionEntry): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT OR IGNORE INTO music_collection_entries (track_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)', entry.trackId, entry.targetType, entry.targetId ?? '', entry.createdAt));
  }

  async removeMusicCollectionEntry(trackId: string, targetType: MusicCollectionTargetType, targetId: string | null): Promise<boolean> {
    return this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM music_collection_entries WHERE track_id = ? AND target_type = ? AND target_id = ?', trackId, targetType, targetId ?? '');
      const remaining = await transaction.getFirstAsync<{ present: number }>('SELECT 1 AS present FROM music_collection_entries WHERE track_id = ? LIMIT 1', trackId);
      if (remaining) return false;
      const deleted = await transaction.runAsync('DELETE FROM music_tracks WHERE id = ?', trackId);
      return deleted.changes > 0;
    });
  }

  async listMusicPlaylists(): Promise<MusicPlaylist[]> {
    const rows = await this.db.getAllAsync<MusicPlaylistRow>('SELECT id, name, cover_media_id, created_at, updated_at FROM music_playlists ORDER BY updated_at DESC, created_at DESC');
    return rows.map((row) => ({ id: row.id, name: row.name, coverMediaId: row.cover_media_id, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async createMusicPlaylist(playlist: MusicPlaylist): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO music_playlists (id, name, cover_media_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', playlist.id, playlist.name, playlist.coverMediaId, playlist.createdAt, playlist.updatedAt));
  }

  async updateMusicPlaylist(playlist: MusicPlaylist): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE music_playlists SET name = ?, cover_media_id = ?, updated_at = ? WHERE id = ?', playlist.name, playlist.coverMediaId, playlist.updatedAt, playlist.id));
  }

  async deleteMusicPlaylist(playlistId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM music_playlists WHERE id = ?', playlistId));
  }

  async listMusicPlaylistEntries(): Promise<MusicPlaylistEntry[]> {
    const rows = await this.db.getAllAsync<MusicPlaylistEntryRow>('SELECT playlist_id, track_id, added_at FROM music_playlist_entries ORDER BY added_at');
    return rows.map((row) => ({ playlistId: row.playlist_id, trackId: row.track_id, addedAt: row.added_at }));
  }

  async addMusicPlaylistEntries(entries: MusicPlaylistEntry[]): Promise<void> {
    await this.withTransaction(async (transaction) => {
      for (const entry of entries) await transaction.runAsync('INSERT OR IGNORE INTO music_playlist_entries (playlist_id, track_id, added_at) VALUES (?, ?, ?)', entry.playlistId, entry.trackId, entry.addedAt);
    });
  }

  async removeMusicPlaylistEntry(playlistId: string, trackId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM music_playlist_entries WHERE playlist_id = ? AND track_id = ?', playlistId, trackId));
  }

  async listBookLists(): Promise<BookList[]> {
    const rows = await this.db.getAllAsync<BookListRow>('SELECT id, name, created_at, updated_at FROM book_lists ORDER BY updated_at DESC, created_at DESC');
    return rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async createBookList(list: BookList): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO book_lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', list.id, list.name, list.createdAt, list.updatedAt));
  }

  async updateBookList(list: BookList): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE book_lists SET name = ?, updated_at = ? WHERE id = ?', list.name, list.updatedAt, list.id));
  }

  async deleteBookList(listId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM book_lists WHERE id = ?', listId));
  }

  async listBookListEntries(): Promise<BookListEntry[]> {
    const rows = await this.db.getAllAsync<BookListEntryRow>('SELECT list_id, book_id, added_at FROM book_list_entries ORDER BY added_at');
    return rows.map((row) => ({ listId: row.list_id, bookId: row.book_id, addedAt: row.added_at }));
  }

  async addBookListEntries(entries: BookListEntry[]): Promise<void> {
    await this.withTransaction(async (transaction) => {
      for (const entry of entries) await transaction.runAsync('INSERT OR IGNORE INTO book_list_entries (list_id, book_id, added_at) VALUES (?, ?, ?)', entry.listId, entry.bookId, entry.addedAt);
    });
  }

  async removeBookListEntry(listId: string, bookId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM book_list_entries WHERE list_id = ? AND book_id = ?', listId, bookId));
  }

  async listBooks(): Promise<Book[]> {
    const rows = await this.db.getAllAsync<BookRow>('SELECT id, file_media_id, cover_media_id, title, author, format, parse_status, parse_message, progress, last_read_at, location, location_type, chapter_href, chapter_title, engine_version, page_count, chapter_cache_json, created_at, updated_at FROM books ORDER BY last_read_at IS NULL, last_read_at DESC, created_at DESC');
    return rows.map(mapBook);
  }

  async createBook(book: Book): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO books (id, file_media_id, cover_media_id, title, author, format, parse_status, parse_message, progress, last_read_at, location, location_type, chapter_href, chapter_title, engine_version, page_count, chapter_cache_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', book.id, book.fileMediaId, book.coverMediaId, book.title, book.author, book.format, book.parseStatus, book.parseMessage, book.progress, book.lastReadAt ?? null, book.location, book.locationType ?? null, book.chapterHref ?? null, book.chapterTitle ?? null, book.engineVersion ?? null, book.pageCount ?? null, JSON.stringify(book.chapterCache ?? []), book.createdAt, book.updatedAt));
  }

  async updateBook(book: Book): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE books SET cover_media_id = ?, title = ?, author = ?, format = ?, parse_status = ?, parse_message = ?, progress = ?, last_read_at = ?, location = ?, location_type = ?, chapter_href = ?, chapter_title = ?, engine_version = ?, page_count = ?, chapter_cache_json = ?, updated_at = ? WHERE id = ?', book.coverMediaId, book.title, book.author, book.format, book.parseStatus, book.parseMessage, book.progress, book.lastReadAt ?? null, book.location, book.locationType ?? null, book.chapterHref ?? null, book.chapterTitle ?? null, book.engineVersion ?? null, book.pageCount ?? null, JSON.stringify(book.chapterCache ?? []), book.updatedAt, book.id));
  }

  async deleteBook(bookId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM books WHERE id = ?', bookId));
  }

  async listBookExcerpts(bookId?: string): Promise<BookExcerpt[]> {
    const rows = bookId
      ? await this.db.getAllAsync<BookExcerptRow>('SELECT id, book_id, text, location, note, location_type, chapter_title, context_before, context_after, source_kind, created_at FROM book_excerpts WHERE book_id = ? ORDER BY created_at DESC', bookId)
      : await this.db.getAllAsync<BookExcerptRow>('SELECT id, book_id, text, location, note, location_type, chapter_title, context_before, context_after, source_kind, created_at FROM book_excerpts ORDER BY created_at DESC');
    return rows.map(mapBookExcerpt);
  }

  async createBookExcerpt(excerpt: BookExcerpt): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO book_excerpts (id, book_id, text, location, note, location_type, chapter_title, context_before, context_after, source_kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', excerpt.id, excerpt.bookId, excerpt.text, excerpt.location, excerpt.note, excerpt.locationType ?? null, excerpt.chapterTitle ?? null, excerpt.contextBefore ?? null, excerpt.contextAfter ?? null, excerpt.sourceKind ?? 'manual', excerpt.createdAt));
  }

  async updateBookExcerpt(excerpt: BookExcerpt): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE book_excerpts SET text = ?, location = ?, note = ?, location_type = ?, chapter_title = ?, context_before = ?, context_after = ?, source_kind = ? WHERE id = ?', excerpt.text, excerpt.location, excerpt.note, excerpt.locationType ?? null, excerpt.chapterTitle ?? null, excerpt.contextBefore ?? null, excerpt.contextAfter ?? null, excerpt.sourceKind ?? 'manual', excerpt.id));
  }

  async deleteBookExcerpt(excerptId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM book_excerpts WHERE id = ?', excerptId));
  }

  async listReadingNoteSources(): Promise<ReadingNoteSource[]> {
    const rows = await this.db.getAllAsync<{ post_id: string; book_id: string | null; excerpt_ids_json: string; quote_snapshots_json: string }>('SELECT post_id, book_id, excerpt_ids_json, quote_snapshots_json FROM reading_note_sources ORDER BY post_id');
    return rows.map((row) => ({ postId: row.post_id, bookId: row.book_id, excerptIds: parseStringList(row.excerpt_ids_json), quoteSnapshots: parseQuoteSnapshots(row.quote_snapshots_json) }));
  }

  async getReadingNoteSource(postId: string): Promise<ReadingNoteSource | null> {
    const row = await this.db.getFirstAsync<{ post_id: string; book_id: string | null; excerpt_ids_json: string; quote_snapshots_json: string }>('SELECT post_id, book_id, excerpt_ids_json, quote_snapshots_json FROM reading_note_sources WHERE post_id = ?', postId);
    if (!row) return null;
    return { postId: row.post_id, bookId: row.book_id, excerptIds: parseStringList(row.excerpt_ids_json), quoteSnapshots: parseQuoteSnapshots(row.quote_snapshots_json) };
  }

  async saveReadingNoteSource(source: ReadingNoteSource): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO reading_note_sources (post_id, book_id, excerpt_ids_json, quote_snapshots_json) VALUES (?, ?, ?, ?)
       ON CONFLICT(post_id) DO UPDATE SET book_id = excluded.book_id, excerpt_ids_json = excluded.excerpt_ids_json, quote_snapshots_json = excluded.quote_snapshots_json`,
      source.postId, source.bookId, JSON.stringify(source.excerptIds), JSON.stringify(source.quoteSnapshots),
    ));
  }

  async listMemoryNotificationSchedules(): Promise<MemoryNotificationSchedule[]> {
    const rows = await this.db.getAllAsync<{ id: string; post_id: string; scheduled_at: string; platform_identifier: string }>('SELECT id, post_id, scheduled_at, platform_identifier FROM memory_notification_schedules ORDER BY scheduled_at');
    return rows.map((row) => ({ id: row.id, postId: row.post_id, scheduledAt: row.scheduled_at, platformIdentifier: row.platform_identifier }));
  }

  async replaceMemoryNotificationSchedules(items: MemoryNotificationSchedule[]): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM memory_notification_schedules');
      for (const item of items) await transaction.runAsync('INSERT INTO memory_notification_schedules (id, post_id, scheduled_at, platform_identifier) VALUES (?, ?, ?, ?)', item.id, item.postId, item.scheduledAt, item.platformIdentifier);
    });
  }

  async listMemoryNotificationExposures(): Promise<MemoryNotificationExposure[]> {
    const rows = await this.db.getAllAsync<{ post_id: string; shown_at: string; review_count: number }>("SELECT post_id, shown_at, review_count FROM memory_exposures WHERE kind = 'notification'");
    return rows.map((row) => ({ postId: row.post_id, lastShownAt: row.shown_at, reviewCount: row.review_count }));
  }

  async recordMemoryNotificationExposure(postId: string, shownAt: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO memory_exposures (post_id, kind, shown_at, review_count) VALUES (?, 'notification', ?, 1)
       ON CONFLICT(post_id, kind) DO UPDATE SET
         review_count = memory_exposures.review_count + CASE WHEN excluded.shown_at > memory_exposures.shown_at THEN 1 ELSE 0 END,
         shown_at = MAX(memory_exposures.shown_at, excluded.shown_at)`,
      postId,
      shownAt,
    ));
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
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO memory_exposures (post_id, kind, shown_at) VALUES (?, 'person', ?)
       ON CONFLICT(post_id, kind) DO UPDATE SET shown_at = excluded.shown_at`,
      memory.post.id,
      new Date().toISOString(),
    ));
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
      musicPlaybackMode: values.musicPlaybackMode === 'shuffle' || values.musicPlaybackMode === 'single' ? values.musicPlaybackMode : 'list',
      miniPlayerX: Number.isFinite(Number(values.miniPlayerX)) ? Number(values.miniPlayerX) : 0,
      miniPlayerY: Number.isFinite(Number(values.miniPlayerY)) ? Number(values.miniPlayerY) : 0,
      miniPlayerEdge: values.miniPlayerEdge === 'left' || values.miniPlayerEdge === 'right' ? values.miniPlayerEdge : null,
      miniPlayerYRatio: values.miniPlayerYRatio && Number.isFinite(Number(values.miniPlayerYRatio)) ? Math.max(0, Math.min(1, Number(values.miniPlayerYRatio))) : null,
      readerPreferencesJson: values.readerPreferencesJson ?? '{}',
    };
  }

  async updatePreferences(changes: Partial<AppPreferences>): Promise<void> {
    await this.withTransaction(async (transaction) => {
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
    await this.withTransaction(async (transaction) => {
      await transaction.execAsync("DELETE FROM profile_collection_requests; DELETE FROM birthday_notification_schedules; DELETE FROM memory_notification_schedules; DELETE FROM reading_note_sources; DELETE FROM book_excerpts; DELETE FROM person_books; DELETE FROM book_list_entries; DELETE FROM book_lists; DELETE FROM books; DELETE FROM music_playlist_entries; DELETE FROM music_playlists; DELETE FROM music_collection_entries; DELETE FROM music_tracks; DELETE FROM album_media; DELETE FROM person_albums; DELETE FROM person_tag_assignments; DELETE FROM tag_definitions; DELETE FROM tag_groups; DELETE FROM tag_system_settings; INSERT INTO tag_system_settings (system, enabled, sort_order) VALUES ('mbti', 1, 0), ('constellation', 1, 1), ('zodiac', 1, 2), ('custom', 1, 3); DELETE FROM memory_exposures; DELETE FROM post_persons; DELETE FROM posts; DELETE FROM drafts; DELETE FROM checkins; DELETE FROM persons; DELETE FROM media; DELETE FROM settings;");
    });
  }

  async exportBackupSnapshot(): Promise<BackupSnapshot> {
    const [checkInRows, posts, draftRows, people, media, postPersonRows, settingRows, tagDefinitions, tagGroups, tagSystemSettings, personTags, albums, albumMedia, personBooks, musicTracks, musicCollectionEntries, musicPlaylists, musicPlaylistEntries, bookLists, bookListEntries, books, bookExcerpts, readingNoteSources] = await Promise.all([
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
      this.listPersonBooks(),
      this.listMusicTracks(),
      this.listMusicCollectionEntries(),
      this.listMusicPlaylists(),
      this.listMusicPlaylistEntries(),
      this.listBookLists(),
      this.listBookListEntries(),
      this.listBooks(),
      this.listBookExcerpts(),
      this.db.getAllAsync<{ post_id: string; book_id: string | null; excerpt_ids_json: string; quote_snapshots_json: string }>('SELECT post_id, book_id, excerpt_ids_json, quote_snapshots_json FROM reading_note_sources ORDER BY post_id'),
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
      personBooks,
      musicTracks,
      musicCollectionEntries,
      musicPlaylists,
      musicPlaylistEntries,
      bookLists,
      bookListEntries,
      books,
      bookExcerpts,
      readingNoteSources: readingNoteSources.map((row) => ({ postId: row.post_id, bookId: row.book_id, excerptIds: parseStringList(row.excerpt_ids_json), quoteSnapshots: parseQuoteSnapshots(row.quote_snapshots_json) })),
    };
  }

  async replaceFromBackup(snapshot: BackupSnapshot): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.execAsync('DELETE FROM birthday_notification_schedules; DELETE FROM memory_notification_schedules; DELETE FROM reading_note_sources; DELETE FROM book_excerpts; DELETE FROM person_books; DELETE FROM book_list_entries; DELETE FROM book_lists; DELETE FROM books; DELETE FROM music_playlist_entries; DELETE FROM music_playlists; DELETE FROM music_collection_entries; DELETE FROM music_tracks; DELETE FROM album_media; DELETE FROM person_albums; DELETE FROM person_tag_assignments; DELETE FROM tag_definitions; DELETE FROM tag_groups; DELETE FROM tag_system_settings; DELETE FROM memory_exposures; DELETE FROM post_persons; DELETE FROM posts; DELETE FROM drafts; DELETE FROM checkins; DELETE FROM persons; DELETE FROM media; DELETE FROM settings;');
      for (const checkIn of snapshot.checkIns) {
        await transaction.runAsync('INSERT INTO checkins (id, day_key, city, created_at) VALUES (?, ?, ?, ?)', checkIn.id, checkIn.dayKey, checkIn.city, checkIn.createdAt);
      }
      for (const person of snapshot.people) {
        await transaction.runAsync(
          'INSERT INTO persons (id, name, avatar_media_id, gender, relation_to_me, impression, birthday_calendar, birthday_year, birthday_month, birthday_day, birthday_is_leap_month, birthday_reminder_mode, birthday_reminder_enabled, birthday_reminder_hour, birthday_reminder_minute, memory_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          person.id, person.name, person.avatarMediaId, person.gender, person.relationToMe, person.impression, person.birthday?.calendar ?? null, person.birthday?.year ?? null, person.birthday?.month ?? null, person.birthday?.day ?? null, person.birthday?.isLeapMonth ? 1 : 0, person.birthday?.reminderMode ?? null, person.birthday?.reminderEnabled === false ? 0 : 1, person.birthday?.reminderHour ?? null, person.birthday?.reminderMinute ?? null, person.memoryEnabled ? 1 : 0, person.createdAt, person.updatedAt,
        );
      }
      for (const item of snapshot.media) {
        await transaction.runAsync(
          'INSERT INTO media (id, local_path, mime_type, width, height, checksum, created_at, kind, original_name, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          item.id, item.localPath, item.mimeType, item.width, item.height, item.checksum, item.createdAt, item.kind ?? null, item.originalName ?? null, item.sizeBytes ?? null,
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
      for (const track of snapshot.musicTracks ?? []) await transaction.runAsync('INSERT INTO music_tracks (id, media_id, cover_media_id, title, artist, album, duration_ms, play_count, owner_type, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)', track.id, track.mediaId, track.coverMediaId ?? null, track.title, track.artist, track.album, track.durationMs, track.playCount, 'unassigned', track.createdAt, track.updatedAt);
      for (const entry of snapshot.musicCollectionEntries ?? []) await transaction.runAsync('INSERT INTO music_collection_entries (track_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)', entry.trackId, entry.targetType, entry.targetId ?? '', entry.createdAt);
      for (const playlist of snapshot.musicPlaylists ?? []) await transaction.runAsync('INSERT INTO music_playlists (id, name, cover_media_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', playlist.id, playlist.name, playlist.coverMediaId ?? null, playlist.createdAt, playlist.updatedAt);
      for (const entry of snapshot.musicPlaylistEntries ?? []) await transaction.runAsync('INSERT INTO music_playlist_entries (playlist_id, track_id, added_at) VALUES (?, ?, ?)', entry.playlistId, entry.trackId, entry.addedAt);
      for (const book of snapshot.books ?? []) await transaction.runAsync('INSERT INTO books (id, file_media_id, cover_media_id, title, author, format, parse_status, parse_message, progress, last_read_at, location, location_type, chapter_href, chapter_title, engine_version, page_count, chapter_cache_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', book.id, book.fileMediaId, book.coverMediaId, book.title, book.author, book.format, book.parseStatus, book.parseMessage, book.progress, book.lastReadAt ?? null, book.location, book.locationType ?? null, book.chapterHref ?? null, book.chapterTitle ?? null, book.engineVersion ?? null, book.pageCount ?? null, JSON.stringify(book.chapterCache ?? []), book.createdAt, book.updatedAt);
      for (const list of snapshot.bookLists ?? []) await transaction.runAsync('INSERT INTO book_lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', list.id, list.name, list.createdAt, list.updatedAt);
      for (const entry of snapshot.bookListEntries ?? []) await transaction.runAsync('INSERT INTO book_list_entries (list_id, book_id, added_at) VALUES (?, ?, ?)', entry.listId, entry.bookId, entry.addedAt);
      for (const relation of snapshot.personBooks ?? []) await transaction.runAsync('INSERT INTO person_books (person_id, book_id, created_at) VALUES (?, ?, ?)', relation.personId, relation.bookId, relation.createdAt);
      for (const excerpt of snapshot.bookExcerpts ?? []) await transaction.runAsync('INSERT INTO book_excerpts (id, book_id, text, location, note, location_type, chapter_title, context_before, context_after, source_kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', excerpt.id, excerpt.bookId, excerpt.text, excerpt.location, excerpt.note, excerpt.locationType ?? null, excerpt.chapterTitle ?? null, excerpt.contextBefore ?? null, excerpt.contextAfter ?? null, excerpt.sourceKind ?? 'manual', excerpt.createdAt);
      for (const source of snapshot.readingNoteSources ?? []) await transaction.runAsync('INSERT INTO reading_note_sources (post_id, book_id, excerpt_ids_json, quote_snapshots_json) VALUES (?, ?, ?, ?)', source.postId, source.bookId, JSON.stringify(source.excerptIds), JSON.stringify(source.quoteSnapshots));
      for (const [key, value] of Object.entries(snapshot.settings)) {
        await transaction.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', key, value);
      }
    });
  }
}
