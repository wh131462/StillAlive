import type { SQLiteDatabase } from 'expo-sqlite';
import type { StillAliveRepository } from './repository-contract';
import type { AlbumMedia, AppThemeId, BirthdayCalendar, BirthdayNotificationSchedule, BirthdayReminderMode, Book, BookExcerpt, BookFormat, BookList, BookListEntry, BookLocationType, BookParseStatus, CheckIn, DayKey, Draft, LedgerTransaction, Media, MusicCollectionEntry, MusicCollectionTargetType, MusicPlaybackMode, MusicPlaylist, MusicPlaylistEntry, MusicTrack, NameStyleId, Person, PersonAlbum, PersonBook, PersonEvent, PersonRelationship, PersonRelationshipNode, PersonTagAssignment, Post, ProfileCollectionField, ProfileCollectionRequest, ProfileCollectionRequestStatus, ReaderTocItem, ReadingNoteSource, TagDefinition, TagGroup, TagSystemSetting } from '@still-alive/types';
import type { MemoryNotificationExposure, MemoryNotificationSchedule } from '../../features/home/memory-notifications';
import type { AppPreferences, BackupSnapshot, BookExcerptRow, BookListEntryRow, BookListRow, BookRow, CheckInRow, DraftRow, HomeMemory, LedgerTransactionRow, MediaRow, MusicCollectionEntryRow, MusicPlaylistEntryRow, MusicPlaylistRow, MusicTrackRow, PersonBookRow, PersonEventRow, PersonRelationshipNodeRow, PersonRelationshipRow, PersonRow, PostRow, ProfileCollectionRequestRow, AiProviderProfileRow, AiUsageRecordRow, AiConversationRow, AiChatMessageRow, KnowledgeAggregateRow, KnowledgeChunkRow, KnowledgeSourceRow, MemoryItemRow, MemoryRevisionRowModel, MemorySourceRowModel } from './database-models';
import { createLocalId, defaultTagSystemSettings, mapBook, mapBookExcerpt, mapCheckIn, mapDraft, mapLedgerTransaction, mapMedia, mapMusicTrack, mapPerson, mapPersonEvent, mapPost, mapProfileCollectionRequest, parseAppTheme, parseGender, parseNameStyle, parseQuoteSnapshots, parseStringList } from './sqlite-mappers';
import { writePersistentError } from '../platform/persistent-log';
import { AI_USAGE_TASK_IDS } from '../ai/ai-types';
import type { AggregateGenerator, KnowledgeAggregate, KnowledgeChunk, KnowledgeSourceKind, KnowledgeSourceSignature, MemoryItem, MemoryKind, MemoryOrigin, MemoryRevision, MemorySourceRef, MemorySourceRow, MemoryStatus, MemorySubjectType } from '../../features/ai/domain/knowledge-types';
import type { AiChatMessage, AiConversation, AiConversationSource, AiProviderProfile, AiUsageRecord, AiUsageTaskId } from '../ai/ai-types';

function mediaKindForMimeType(mimeType: string): 'image' | 'video' | 'audio' {
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'image';
}

export class SQLiteStillAliveRepository implements StillAliveRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly db: SQLiteDatabase) {}

  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.writeQueue.catch((cause) => {
      writePersistentError('database.write-queue.previous-failed', cause);
    }).then(operation);
    const observedTask = task.catch((cause) => {
      writePersistentError('database.write.failed', cause);
      throw cause;
    });
    this.writeQueue = observedTask.then(() => undefined, () => undefined);
    return observedTask;
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

  async listLedgerTransactions(): Promise<LedgerTransaction[]> {
    const rows = await this.db.getAllAsync<LedgerTransactionRow>('SELECT id, type, amount_cents, category, day_key, note, created_at, updated_at FROM ledger_transactions ORDER BY day_key DESC, created_at DESC');
    return rows.map(mapLedgerTransaction);
  }

  async createLedgerTransaction(transaction: LedgerTransaction): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      'INSERT INTO ledger_transactions (id, type, amount_cents, category, day_key, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      transaction.id, transaction.type, transaction.amountCents, transaction.category, transaction.dayKey, transaction.note, transaction.createdAt, transaction.updatedAt,
    ));
  }

  async updateLedgerTransaction(transaction: LedgerTransaction): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      'UPDATE ledger_transactions SET type = ?, amount_cents = ?, category = ?, day_key = ?, note = ?, updated_at = ? WHERE id = ?',
      transaction.type, transaction.amountCents, transaction.category, transaction.dayKey, transaction.note, transaction.updatedAt, transaction.id,
    ));
  }

  async deleteLedgerTransaction(transactionId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM ledger_transactions WHERE id = ?', transactionId));
  }

  async createPost(post: Post, personIds: string[] = []): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync(
        'INSERT INTO posts (id, day_key, body_markdown, location_name, pinned, created_at, updated_at, comments_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        post.id,
        post.dayKey,
        post.bodyMarkdown,
        post.locationName,
        post.pinned ? 1 : 0,
        post.createdAt,
        post.updatedAt,
        JSON.stringify(post.comments ?? []),
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
        'UPDATE posts SET body_markdown = ?, location_name = ?, pinned = ?, updated_at = ? WHERE id = ?',
        post.bodyMarkdown,
        post.locationName,
        post.pinned ? 1 : 0,
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

  async setPostPinned(postId: string, pinned: boolean): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      'UPDATE posts SET pinned = ?, updated_at = ? WHERE id = ?',
      pinned ? 1 : 0,
      new Date().toISOString(),
      postId,
    ));
  }

  async savePostComment(postId: string, body: string | null, commentId?: string, mediaIds?: string[]): Promise<void> {
    await this.withTransaction(async (transaction) => {
      const row = await transaction.getFirstAsync<PostRow>('SELECT * FROM posts WHERE id = ?', postId);
      if (!row) throw new Error('记录不存在或已被删除');
      const comments = mapPost(row).comments;
      const existing = comments.find((comment) => comment.id === commentId);
      if (commentId && !existing) throw new Error('评论不存在或已被删除');
      const images = [...new Set(mediaIds ?? existing?.mediaIds ?? [])];
      if (body !== null) {
        if (!body.trim() && !images.length) throw new Error('请填写评论或选择图片');
        for (const id of images) {
          const image = await transaction.getFirstAsync<{ mime_type: string }>('SELECT mime_type FROM media WHERE id = ?', id);
          if (!image?.mime_type.startsWith('image/')) throw new Error('评论图片不存在或格式不受支持');
        }
      }
      const now = new Date().toISOString();
      const next = body === null
        ? comments.filter((comment) => comment.id !== commentId)
        : existing
          ? comments.map((comment) => comment.id === commentId ? { ...comment, body: body.trim(), mediaIds: images, updatedAt: now } : comment)
          : [...comments, { id: createLocalId('comment'), body: body.trim(), mediaIds: images, createdAt: now, updatedAt: now }];
      await transaction.runAsync('UPDATE posts SET comments_json = ? WHERE id = ?', JSON.stringify(next), postId);
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
      'SELECT id, day_key, body_markdown, location_name, pinned, comments_json, created_at, updated_at FROM posts ORDER BY pinned DESC, day_key DESC, created_at DESC',
    );
    return rows.map(mapPost);
  }

  async listPostsByDay(dayKey: DayKey): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      'SELECT id, day_key, body_markdown, location_name, pinned, comments_json, created_at, updated_at FROM posts WHERE day_key = ? ORDER BY pinned DESC, created_at DESC',
      dayKey,
    );
    return rows.map(mapPost);
  }

  async listPostsByPerson(personId: string): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      `SELECT posts.id, posts.day_key, posts.body_markdown, posts.location_name, posts.pinned, posts.comments_json, posts.created_at, posts.updated_at
       FROM posts
       INNER JOIN post_persons ON post_persons.post_id = posts.id
       WHERE post_persons.person_id = ?
       ORDER BY posts.pinned DESC, posts.day_key DESC, posts.created_at DESC`,
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
        SELECT 1 FROM posts, json_each(posts.comments_json) AS comment, json_each(comment.value, '$.mediaIds') AS image WHERE image.value = ?
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
      mediaId,
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
      `SELECT id, name, nickname, bio, avatar_media_id, gender, relation_to_me, impression,
              birthday_calendar, birthday_year, birthday_month, birthday_day, birthday_is_leap_month, birthday_reminder_mode,
              birthday_reminder_enabled, birthday_reminder_hour, birthday_reminder_minute,
              contacts_json, custom_fields_json, important_dates_json, privacy_mode, memory_enabled, created_at, updated_at
       FROM persons ORDER BY updated_at DESC`,
    );
    return rows.map(mapPerson);
  }

  async createPerson(person: Person): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO persons (id, name, nickname, bio, avatar_media_id, gender, relation_to_me, impression, birthday_calendar, birthday_year, birthday_month, birthday_day, birthday_is_leap_month, birthday_reminder_mode, birthday_reminder_enabled, birthday_reminder_hour, birthday_reminder_minute, contacts_json, custom_fields_json, important_dates_json, privacy_mode, memory_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      person.id,
      person.name,
      person.nickname,
      person.bio,
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
      JSON.stringify(person.contacts),
      JSON.stringify(person.customFields ?? {}),
      JSON.stringify(person.importantDates ?? []),
      person.privacyMode ?? 'normal',
      person.memoryEnabled ? 1 : 0,
      person.createdAt,
      person.updatedAt,
    ));
  }

  async updatePerson(person: Person): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `UPDATE persons
       SET name = ?, nickname = ?, bio = ?, avatar_media_id = ?, gender = ?, relation_to_me = ?, impression = ?,
           birthday_calendar = ?, birthday_year = ?, birthday_month = ?, birthday_day = ?, birthday_is_leap_month = ?, birthday_reminder_mode = ?,
           birthday_reminder_enabled = ?, birthday_reminder_hour = ?, birthday_reminder_minute = ?,
           contacts_json = ?, custom_fields_json = ?, important_dates_json = ?, privacy_mode = ?, memory_enabled = ?, updated_at = ?
       WHERE id = ?`,
      person.name,
      person.nickname,
      person.bio,
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
      JSON.stringify(person.contacts),
      JSON.stringify(person.customFields ?? {}),
      JSON.stringify(person.importantDates ?? []),
      person.privacyMode ?? 'normal',
      person.memoryEnabled ? 1 : 0,
      person.updatedAt,
      person.id,
    ));
  }

  async deletePerson(personId: string): Promise<string[]> {
    return this.withTransaction(async (transaction) => {
      const musicRows = await transaction.getAllAsync<{ track_id: string }>("SELECT track_id FROM music_collection_entries WHERE target_type = 'person' AND target_id = ?", personId);
      const eventRows = await transaction.getAllAsync<PersonEventRow>('SELECT id, person_id, title, description, time_text, participant_ids_json, pinned, sort_order, created_at, updated_at FROM person_events WHERE participant_ids_json LIKE ?', `%${personId}%`);
      for (const row of eventRows) {
        if (row.person_id === personId) continue;
        const participantIds = parseStringList(row.participant_ids_json ?? undefined).filter((id) => id !== personId);
        await transaction.runAsync('UPDATE person_events SET participant_ids_json = ? WHERE id = ?', JSON.stringify(participantIds), row.id);
      }
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

  async listPersonEvents(personId?: string): Promise<PersonEvent[]> {
    const rows = await this.db.getAllAsync<PersonEventRow>(
      `SELECT id, person_id, title, description, time_text, participant_ids_json, pinned, sort_order, created_at, updated_at
       FROM person_events ${personId ? 'WHERE person_id = ?' : ''} ORDER BY pinned DESC, sort_order, created_at DESC`,
      ...(personId ? [personId] : []),
    );
    return rows.map(mapPersonEvent);
  }

  async savePersonEvent(event: PersonEvent): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO person_events (id, person_id, title, description, time_text, participant_ids_json, pinned, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET person_id = excluded.person_id, title = excluded.title, description = excluded.description,
       time_text = excluded.time_text, participant_ids_json = excluded.participant_ids_json, pinned = excluded.pinned,
       sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
      event.id, event.personId, event.title, event.description, event.timeText, JSON.stringify(event.participantIds), event.pinned ? 1 : 0, event.sortOrder, event.createdAt, event.updatedAt,
    ));
  }

  async deletePersonEvent(eventId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM person_events WHERE id = ?', eventId));
  }

  async mergePersons(targetPersonId: string, sourcePersonIds: string[]): Promise<void> {
    const sourceIds = [...new Set(sourcePersonIds)].filter((id) => id && id !== targetPersonId);
    if (!sourceIds.length) return;
    const people = await this.listPeople();
    const target = people.find((person) => person.id === targetPersonId);
    const sources = sourceIds.map((id) => people.find((person) => person.id === id)).filter((person): person is Person => Boolean(person));
    if (!target || sources.length !== sourceIds.length) throw new Error('人物不存在或已删除');
    const mergedContacts = [...target.contacts];
    for (const source of sources) for (const contact of source.contacts) if (!mergedContacts.some((item) => item.type === contact.type && item.value === contact.value)) mergedContacts.push(contact);
    const mergedCustomFields = { ...target.customFields };
    const mergedImportantDates = [...target.importantDates];
    for (const source of sources) {
      for (const [key, value] of Object.entries(source.customFields)) if (!mergedCustomFields[key]) mergedCustomFields[key] = value;
      for (const item of source.importantDates) if (!mergedImportantDates.some((date) => date.name === item.name && date.date === item.date)) mergedImportantDates.push(item);
    }
    const firstNonEmpty = <T>(value: T | null, fallback: (T | null)[]): T | null => value !== null && value !== undefined && value !== '' ? value : fallback.find((item) => item !== null && item !== undefined && item !== '') ?? null;
    const sourceValues = (key: keyof Person) => sources.map((item) => item[key] as never);
    const merged: Person = {
      ...target,
      nickname: firstNonEmpty(target.nickname, sourceValues('nickname')) ?? '',
      bio: firstNonEmpty(target.bio, sourceValues('bio')),
      avatarMediaId: firstNonEmpty(target.avatarMediaId, sourceValues('avatarMediaId')),
      gender: firstNonEmpty(target.gender, sourceValues('gender')),
      relationToMe: firstNonEmpty(target.relationToMe, sourceValues('relationToMe')),
      impression: firstNonEmpty(target.impression, sourceValues('impression')),
      birthday: firstNonEmpty(target.birthday, sourceValues('birthday')),
      contacts: mergedContacts,
      customFields: mergedCustomFields,
      importantDates: mergedImportantDates,
      privacyMode: target.privacyMode === 'private' || sources.some((item) => item.privacyMode === 'private') ? 'private' : 'normal',
      updatedAt: new Date().toISOString(),
    };
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync(`UPDATE persons SET nickname = ?, bio = ?, avatar_media_id = ?, gender = ?, relation_to_me = ?, impression = ?, birthday_calendar = ?, birthday_year = ?, birthday_month = ?, birthday_day = ?, birthday_is_leap_month = ?, birthday_reminder_mode = ?, birthday_reminder_enabled = ?, birthday_reminder_hour = ?, birthday_reminder_minute = ?, contacts_json = ?, custom_fields_json = ?, important_dates_json = ?, privacy_mode = ?, updated_at = ? WHERE id = ?`, merged.nickname, merged.bio, merged.avatarMediaId, merged.gender, merged.relationToMe, merged.impression, merged.birthday?.calendar ?? null, merged.birthday?.year ?? null, merged.birthday?.month ?? null, merged.birthday?.day ?? null, merged.birthday?.isLeapMonth ? 1 : 0, merged.birthday?.reminderMode ?? null, merged.birthday?.reminderEnabled === false ? 0 : 1, merged.birthday?.reminderHour ?? null, merged.birthday?.reminderMinute ?? null, JSON.stringify(merged.contacts), JSON.stringify(merged.customFields), JSON.stringify(merged.importantDates), merged.privacyMode, merged.updatedAt, targetPersonId);
      for (const sourceId of sourceIds) {
        await transaction.runAsync('INSERT OR IGNORE INTO post_persons (post_id, person_id) SELECT post_id, ? FROM post_persons WHERE person_id = ?', targetPersonId, sourceId);
        await transaction.runAsync('DELETE FROM post_persons WHERE person_id = ?', sourceId);
        await transaction.runAsync('INSERT OR IGNORE INTO person_books (person_id, book_id, created_at) SELECT ?, book_id, created_at FROM person_books WHERE person_id = ?', targetPersonId, sourceId);
        await transaction.runAsync('DELETE FROM person_books WHERE person_id = ?', sourceId);
        await transaction.runAsync("INSERT OR IGNORE INTO person_tag_assignments (person_id, kind, value) SELECT ?, kind, value FROM person_tag_assignments WHERE person_id = ?", targetPersonId, sourceId);
        await transaction.runAsync('DELETE FROM person_tag_assignments WHERE person_id = ?', sourceId);
        await transaction.runAsync("INSERT OR IGNORE INTO music_collection_entries (track_id, target_type, target_id, created_at) SELECT track_id, target_type, ?, created_at FROM music_collection_entries WHERE target_type = 'person' AND target_id = ?", targetPersonId, sourceId);
        await transaction.runAsync("DELETE FROM music_collection_entries WHERE target_type = 'person' AND target_id = ?", sourceId);
        await transaction.runAsync('UPDATE person_albums SET person_id = ? WHERE person_id = ?', targetPersonId, sourceId);
        await transaction.runAsync('UPDATE person_events SET person_id = ? WHERE person_id = ?', targetPersonId, sourceId);
      }
      const eventRows = await transaction.getAllAsync<PersonEventRow>('SELECT id, person_id, title, description, time_text, participant_ids_json, pinned, sort_order, created_at, updated_at FROM person_events');
      for (const row of eventRows) {
        const currentParticipantIds = parseStringList(row.participant_ids_json ?? undefined);
        const participantIds = currentParticipantIds.map((id) => sourceIds.includes(id) ? targetPersonId : id);
        if (participantIds.join('|') !== currentParticipantIds.join('|')) await transaction.runAsync('UPDATE person_events SET participant_ids_json = ? WHERE id = ?', JSON.stringify([...new Set(participantIds)]), row.id);
      }
      for (const sourceId of sourceIds) {
        const sourceNode = await transaction.getFirstAsync<{ id: string }>('SELECT id FROM person_relationship_nodes WHERE person_id = ?', sourceId);
        const targetNode = await transaction.getFirstAsync<{ id: string }>('SELECT id FROM person_relationship_nodes WHERE person_id = ?', targetPersonId);
        if (sourceNode && targetNode) {
          await transaction.runAsync('UPDATE OR IGNORE person_relationships SET source_node_id = ? WHERE source_node_id = ?', targetNode.id, sourceNode.id);
          await transaction.runAsync('UPDATE OR IGNORE person_relationships SET target_node_id = ? WHERE target_node_id = ?', targetNode.id, sourceNode.id);
          await transaction.runAsync('DELETE FROM person_relationship_nodes WHERE id = ?', sourceNode.id);
        } else if (sourceNode) await transaction.runAsync('UPDATE person_relationship_nodes SET person_id = ? WHERE id = ?', targetPersonId, sourceNode.id);
        await transaction.runAsync('DELETE FROM persons WHERE id = ?', sourceId);
      }
    });
  }

  async listPersonRelationships(): Promise<PersonRelationship[]> {
    const rows = await this.db.getAllAsync<PersonRelationshipRow>('SELECT id, source_node_id, target_node_id, kind, created_at, updated_at FROM person_relationships ORDER BY updated_at DESC');
    return rows.map((row) => ({ id: row.id, sourceNodeId: row.source_node_id, targetNodeId: row.target_node_id, kind: row.kind, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async listPersonRelationshipNodes(): Promise<PersonRelationshipNode[]> {
    const rows = await this.db.getAllAsync<PersonRelationshipNodeRow>('SELECT id, node_type, person_id, label, created_at, updated_at FROM person_relationship_nodes ORDER BY created_at, id');
    return rows.map((row) => ({ id: row.id, kind: row.node_type, personId: row.person_id, label: row.label, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async savePersonRelationshipNode(node: PersonRelationshipNode): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO person_relationship_nodes (id, node_type, person_id, label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET node_type = excluded.node_type, person_id = excluded.person_id, label = excluded.label, updated_at = excluded.updated_at`,
      node.id,
      node.kind,
      node.personId,
      node.label,
      node.createdAt,
      node.updatedAt,
    ));
  }

  async deletePersonRelationshipNode(nodeId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync("DELETE FROM person_relationship_nodes WHERE id = ? AND node_type != 'self'", nodeId));
  }

  async savePersonRelationship(relationship: PersonRelationship): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM person_relationships WHERE id != ? AND source_node_id = ? AND target_node_id = ?', relationship.id, relationship.targetNodeId, relationship.sourceNodeId);
      await transaction.runAsync(
        `INSERT INTO person_relationships (id, source_node_id, target_node_id, kind, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET source_node_id = excluded.source_node_id, target_node_id = excluded.target_node_id, kind = excluded.kind, updated_at = excluded.updated_at`,
        relationship.id,
        relationship.sourceNodeId,
        relationship.targetNodeId,
        relationship.kind,
        relationship.createdAt,
        relationship.updatedAt,
      );
    });
  }

  async deletePersonRelationship(relationshipId: string): Promise<void> {
    await this.withTransaction(async (transaction) => {
      const relationship = await transaction.getFirstAsync<{ source_node_id: string; target_node_id: string }>('SELECT source_node_id, target_node_id FROM person_relationships WHERE id = ?', relationshipId);
      await transaction.runAsync('DELETE FROM person_relationships WHERE id = ?', relationshipId);
      if (!relationship) return;
      for (const nodeId of [relationship.source_node_id, relationship.target_node_id]) {
        await transaction.runAsync(`DELETE FROM person_relationship_nodes
          WHERE id = ? AND node_type != 'self'
            AND NOT EXISTS (SELECT 1 FROM person_relationships WHERE source_node_id = ? OR target_node_id = ?)`, nodeId, nodeId, nodeId);
      }
    });
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
    const rows = await this.db.getAllAsync<{ id: string; person_id: string; event_type: BirthdayNotificationSchedule['eventType']; birthday_day_key: string; important_date_id: string | null; scheduled_at: string; platform_identifier: string }>('SELECT id, person_id, event_type, birthday_day_key, important_date_id, scheduled_at, platform_identifier FROM birthday_notification_schedules ORDER BY scheduled_at');
    return rows.map((row) => ({ id: row.id, personId: row.person_id, eventType: row.event_type, birthdayDayKey: row.birthday_day_key as DayKey, importantDateId: row.important_date_id ?? null, scheduledAt: row.scheduled_at, platformIdentifier: row.platform_identifier }));
  }

  async replaceBirthdayNotificationSchedules(items: BirthdayNotificationSchedule[]): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM birthday_notification_schedules');
      for (const item of items) await transaction.runAsync('INSERT INTO birthday_notification_schedules (id, person_id, event_type, birthday_day_key, important_date_id, scheduled_at, platform_identifier) VALUES (?, ?, ?, ?, ?, ?, ?)', item.id, item.personId, item.eventType, item.birthdayDayKey, item.importantDateId, item.scheduledAt, item.platformIdentifier);
    });
  }

  async createProfileCollectionRequest(request: ProfileCollectionRequest): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO profile_collection_requests
       (id, person_id, fields_json, tag_map_json, expires_at, status, invitation_url, created_at, consumed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      request.id,
      request.personId,
      JSON.stringify(request.fields),
      JSON.stringify(request.tagMap),
      request.expiresAt,
      request.status,
      request.invitationUrl ?? null,
      request.createdAt,
      request.consumedAt,
    ));
  }

  async getProfileCollectionRequest(requestId: string): Promise<ProfileCollectionRequest | null> {
    const row = await this.db.getFirstAsync<ProfileCollectionRequestRow>(
      `SELECT id, person_id, fields_json, tag_map_json, expires_at, status, invitation_url, created_at, consumed_at
       FROM profile_collection_requests WHERE id = ?`,
      requestId,
    );
    return row ? mapProfileCollectionRequest(row) : null;
  }

  async listProfileCollectionRequests(): Promise<ProfileCollectionRequest[]> {
    const rows = await this.db.getAllAsync<ProfileCollectionRequestRow>('SELECT id, person_id, fields_json, tag_map_json, expires_at, status, invitation_url, created_at, consumed_at FROM profile_collection_requests ORDER BY created_at DESC');
    return rows.map(mapProfileCollectionRequest);
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
         SET name = ?, nickname = ?, bio = ?, avatar_media_id = ?, gender = ?, relation_to_me = ?, impression = ?,
             birthday_calendar = ?, birthday_year = ?, birthday_month = ?, birthday_day = ?, birthday_is_leap_month = ?, birthday_reminder_mode = ?,
             birthday_reminder_enabled = ?, birthday_reminder_hour = ?, birthday_reminder_minute = ?,
             memory_enabled = ?, updated_at = ?
         WHERE id = ?`,
        person.name,
        person.nickname,
        person.bio,
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
    const rows = await this.db.getAllAsync<MusicTrackRow>('SELECT id, media_id, cover_media_id, title, artist, album, duration_ms, quality, play_count, created_at, updated_at FROM music_tracks ORDER BY created_at DESC');
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
      // The cover is inserted in this same transaction; derive the foreign key
      // from that record so callers cannot accidentally persist a dangling ID.
      await transaction.runAsync('INSERT INTO music_tracks (id, media_id, cover_media_id, title, artist, album, duration_ms, quality, play_count, owner_type, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)', track.id, track.mediaId, coverMedia?.id ?? null, track.title, track.artist, track.album, track.durationMs, track.quality ?? null, track.playCount, 'unassigned', track.createdAt, track.updatedAt);
      for (const collection of collections) await transaction.runAsync('INSERT INTO music_collection_entries (track_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)', collection.trackId, collection.targetType, collection.targetId ?? '', collection.createdAt);
    });
  }

  async attachMusicTrackCover(trackId: string, coverMedia: Media, expectedCoverMediaId?: string | null): Promise<boolean> {
    return this.withTransaction(async (transaction) => {
      const track = await transaction.getFirstAsync<{ cover_media_id: string | null }>('SELECT cover_media_id FROM music_tracks WHERE id = ?', trackId);
      if (!track) return false;
      const expectedMatches = expectedCoverMediaId === undefined
        ? !track.cover_media_id
        : expectedCoverMediaId
          ? track.cover_media_id === expectedCoverMediaId
          : !track.cover_media_id;
      if (!expectedMatches) return false;
      await transaction.runAsync(
        'INSERT INTO media (id, local_path, mime_type, width, height, checksum, created_at, kind, original_name, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        coverMedia.id, coverMedia.localPath, coverMedia.mimeType, coverMedia.width, coverMedia.height, coverMedia.checksum, coverMedia.createdAt, coverMedia.kind ?? 'image', coverMedia.originalName ?? null, coverMedia.sizeBytes ?? null,
      );
      const updateSql = expectedCoverMediaId === undefined
        ? "UPDATE music_tracks SET cover_media_id = ?, updated_at = ? WHERE id = ? AND (cover_media_id IS NULL OR cover_media_id = '')"
        : expectedCoverMediaId
          ? 'UPDATE music_tracks SET cover_media_id = ?, updated_at = ? WHERE id = ? AND cover_media_id = ?'
          : "UPDATE music_tracks SET cover_media_id = ?, updated_at = ? WHERE id = ? AND (cover_media_id IS NULL OR cover_media_id = '')";
      const updated = await transaction.runAsync(
        updateSql,
        coverMedia.id,
        new Date().toISOString(),
        trackId,
        ...(expectedCoverMediaId ? [expectedCoverMediaId] : []),
      );
      if (updated.changes !== 1) {
        await transaction.runAsync('DELETE FROM media WHERE id = ?', coverMedia.id);
        return false;
      }
      return true;
    });
  }

  async createMusicTrack(track: MusicTrack, collection?: MusicCollectionEntry): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('INSERT INTO music_tracks (id, media_id, cover_media_id, title, artist, album, duration_ms, quality, play_count, owner_type, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)', track.id, track.mediaId, track.coverMediaId ?? null, track.title, track.artist, track.album, track.durationMs, track.quality ?? null, track.playCount, 'unassigned', track.createdAt, track.updatedAt);
      if (collection) await transaction.runAsync('INSERT INTO music_collection_entries (track_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)', collection.trackId, collection.targetType, collection.targetId ?? '', collection.createdAt);
    });
  }

  async updateMusicTrack(track: MusicTrack): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE music_tracks SET cover_media_id = ?, title = ?, artist = ?, album = ?, duration_ms = ?, quality = ?, updated_at = ? WHERE id = ?', track.coverMediaId, track.title, track.artist, track.album, track.durationMs, track.quality ?? null, track.updatedAt, track.id));
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
    await this.enqueueWrite(async () => {
      await this.db.runAsync('UPDATE book_excerpts SET book_title = COALESCE(book_title, (SELECT title FROM books WHERE id = ?)) WHERE book_id = ?', bookId, bookId);
      await this.db.runAsync('DELETE FROM books WHERE id = ?', bookId);
    });
  }

  async listBookExcerpts(bookId?: string): Promise<BookExcerpt[]> {
    const rows = bookId
      ? await this.db.getAllAsync<BookExcerptRow>('SELECT id, book_id, book_title, text, location, note, location_type, chapter_title, context_before, context_after, source_kind, created_at FROM book_excerpts WHERE book_id = ? ORDER BY created_at DESC', bookId)
      : await this.db.getAllAsync<BookExcerptRow>('SELECT id, book_id, book_title, text, location, note, location_type, chapter_title, context_before, context_after, source_kind, created_at FROM book_excerpts ORDER BY created_at DESC');
    return rows.map(mapBookExcerpt);
  }

  async createBookExcerpt(excerpt: BookExcerpt): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO book_excerpts (id, book_id, book_title, text, location, note, location_type, chapter_title, context_before, context_after, source_kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', excerpt.id, excerpt.bookId, excerpt.bookTitle ?? null, excerpt.text, excerpt.location, excerpt.note, excerpt.locationType ?? null, excerpt.chapterTitle ?? null, excerpt.contextBefore ?? null, excerpt.contextAfter ?? null, excerpt.sourceKind ?? 'manual', excerpt.createdAt));
  }

  async updateBookExcerpt(excerpt: BookExcerpt): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('UPDATE book_excerpts SET book_id = ?, book_title = ?, text = ?, location = ?, note = ?, location_type = ?, chapter_title = ?, context_before = ?, context_after = ?, source_kind = ? WHERE id = ?', excerpt.bookId, excerpt.bookTitle ?? null, excerpt.text, excerpt.location, excerpt.note, excerpt.locationType ?? null, excerpt.chapterTitle ?? null, excerpt.contextBefore ?? null, excerpt.contextAfter ?? null, excerpt.sourceKind ?? 'manual', excerpt.id));
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

  async deleteReadingNoteSource(postId: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('DELETE FROM reading_note_sources WHERE post_id = ?', postId));
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
      `SELECT id, day_key, body_markdown, location_name, pinned, comments_json, created_at, updated_at
       FROM posts
       WHERE substr(day_key, 6, 5) = substr(?, 6, 5) AND day_key < ?
       ORDER BY day_key DESC, created_at DESC
       LIMIT 1`,
      today,
      today,
    );
    if (onThisDay) return { kind: 'onThisDay', post: mapPost(onThisDay) };

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const personMemory = await this.db.getFirstAsync<PostRow & { person_id: string; person_name: string; person_nickname: string | null }>(
      `SELECT posts.id, posts.day_key, posts.body_markdown, posts.location_name, posts.pinned, posts.comments_json, posts.created_at, posts.updated_at,
              persons.id AS person_id, persons.name AS person_name, persons.nickname AS person_nickname
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
      person: { id: personMemory.person_id, name: personMemory.person_name, nickname: personMemory.person_nickname ?? '' },
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
      profileName: values.profileName ?? values.nickname ?? '',
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
      notificationPromptShownAt: values.notificationPromptShownAt || null,
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
      hapticsEnabled: values.hapticsEnabled !== 'false',
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
      await transaction.execAsync("DELETE FROM profile_collection_requests; DELETE FROM birthday_notification_schedules; DELETE FROM memory_notification_schedules; DELETE FROM reading_note_sources; DELETE FROM book_excerpts; DELETE FROM person_events; DELETE FROM person_books; DELETE FROM book_list_entries; DELETE FROM book_lists; DELETE FROM books; DELETE FROM music_playlist_entries; DELETE FROM music_playlists; DELETE FROM music_collection_entries; DELETE FROM music_tracks; DELETE FROM album_media; DELETE FROM person_albums; DELETE FROM person_tag_assignments; DELETE FROM person_relationships; DELETE FROM person_relationship_nodes; DELETE FROM tag_definitions; DELETE FROM tag_groups; DELETE FROM tag_system_settings; INSERT INTO tag_system_settings (system, enabled, sort_order) VALUES ('mbti', 1, 0), ('constellation', 1, 1), ('zodiac', 1, 2), ('custom', 1, 3); DELETE FROM memory_exposures; DELETE FROM post_persons; DELETE FROM ledger_transactions; DELETE FROM posts; DELETE FROM drafts; DELETE FROM checkins; DELETE FROM persons; DELETE FROM media; DELETE FROM settings; DELETE FROM ai_provider_profiles; DELETE FROM ai_usage_records; DELETE FROM ai_chat_messages; DELETE FROM ai_conversations; DELETE FROM ai_settings; DELETE FROM knowledge_chunks; DELETE FROM knowledge_sources; DELETE FROM knowledge_aggregates; DELETE FROM knowledge_state; DELETE FROM memory_revisions; DELETE FROM memory_sources; DELETE FROM memory_items; INSERT INTO person_relationship_nodes (id, node_type, person_id, label, created_at, updated_at) VALUES ('self', 'self', NULL, NULL, datetime('now'), datetime('now'));");
    });
  }

  async listAiProviders(): Promise<AiProviderProfile[]> {
    const rows = await this.db.getAllAsync<AiProviderProfileRow>('SELECT * FROM ai_provider_profiles ORDER BY is_default DESC, created_at ASC');
    return rows.map(mapAiProviderProfile);
  }

  async saveAiProvider(provider: AiProviderProfile): Promise<void> {
    await this.withTransaction(async (transaction) => {
      if (provider.isDefault) await transaction.runAsync('UPDATE ai_provider_profiles SET is_default = 0 WHERE id <> ?', provider.id);
      await transaction.runAsync(
        `INSERT INTO ai_provider_profiles (id, label, kind, base_url, model_id, key_hint, supports_stream, supports_balance, enabled, is_default, last_probe_at, last_probe_status, last_probe_latency_ms, last_probe_message, models_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET label = excluded.label, kind = excluded.kind, base_url = excluded.base_url, model_id = excluded.model_id, key_hint = excluded.key_hint,
           supports_stream = excluded.supports_stream, supports_balance = excluded.supports_balance, enabled = excluded.enabled, is_default = excluded.is_default,
           last_probe_at = excluded.last_probe_at, last_probe_status = excluded.last_probe_status, last_probe_latency_ms = excluded.last_probe_latency_ms,
           last_probe_message = excluded.last_probe_message, models_json = excluded.models_json, updated_at = excluded.updated_at`,
        provider.id, provider.label, provider.kind, provider.baseUrl, provider.modelId, provider.keyHint,
        provider.supportsStream ? 1 : 0, provider.supportsBalance ? 1 : 0, provider.enabled ? 1 : 0, provider.isDefault ? 1 : 0,
        provider.lastProbeAt, provider.lastProbeStatus, provider.lastProbeLatencyMs, provider.lastProbeMessage, provider.modelsJson,
        provider.createdAt, provider.updatedAt,
      );
      if (!provider.isDefault) {
        const defaultRow = await transaction.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM ai_provider_profiles WHERE is_default = 1 AND enabled = 1');
        if ((defaultRow?.count ?? 0) === 0 && provider.enabled) {
          await transaction.runAsync('UPDATE ai_provider_profiles SET is_default = 1 WHERE id = ?', provider.id);
        }
      }
    });
  }

  async deleteAiProvider(providerId: string): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM ai_provider_profiles WHERE id = ?', providerId);
      const defaultRow = await transaction.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM ai_provider_profiles WHERE is_default = 1');
      if ((defaultRow?.count ?? 0) === 0) {
        const next = await transaction.getFirstAsync<{ id: string }>('SELECT id FROM ai_provider_profiles WHERE enabled = 1 ORDER BY created_at ASC LIMIT 1');
        if (next) await transaction.runAsync('UPDATE ai_provider_profiles SET is_default = 1 WHERE id = ?', next.id);
      }
    });
  }

  async setDefaultAiProvider(providerId: string): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('UPDATE ai_provider_profiles SET is_default = 0');
      await transaction.runAsync('UPDATE ai_provider_profiles SET is_default = 1, enabled = 1, updated_at = ? WHERE id = ?', new Date().toISOString(), providerId);
    });
  }

  async getAiEnabled(): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ value: string }>("SELECT value FROM ai_settings WHERE key = 'enabled'");
    return row?.value === 'true';
  }

  async setAiEnabled(enabled: boolean): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      "INSERT INTO ai_settings (key, value) VALUES ('enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      enabled ? 'true' : 'false',
    ));
  }

  async getAiSetting(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM ai_settings WHERE key = ?', key);
    return row?.value ?? null;
  }

  async setAiSetting(key: string, value: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO ai_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value));
  }

  async createAiUsageRecord(record: AiUsageRecord): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO ai_usage_records (id, provider_id, provider_kind, model_id, task_id, status, error_code, input_tokens, cached_input_tokens, output_tokens, duration_ms, estimated_cost_micros, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id, record.providerId, record.providerKind, record.modelId, record.taskId, record.status, record.errorCode,
      record.inputTokens, record.cachedInputTokens, record.outputTokens, record.durationMs, record.estimatedCostMicros, record.currency, record.createdAt,
    ));
  }

  async listAiUsageRecords(): Promise<AiUsageRecord[]> {
    const rows = await this.db.getAllAsync<AiUsageRecordRow>('SELECT * FROM ai_usage_records ORDER BY created_at DESC LIMIT 2000');
    return rows.map(mapAiUsageRecord);
  }

  async listAiConversations(): Promise<AiConversation[]> {
    const rows = await this.db.getAllAsync<AiConversationRow>('SELECT * FROM ai_conversations ORDER BY updated_at DESC');
    return rows.map(mapAiConversation);
  }

  async createAiConversation(conversation: AiConversation): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO ai_conversations (id, title, created_at, updated_at, message_count)
       VALUES (?, ?, ?, ?, ?)`,
      conversation.id, conversation.title, conversation.createdAt, conversation.updatedAt, conversation.messageCount,
    ));
  }

  async updateAiConversation(conversation: AiConversation): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      'UPDATE ai_conversations SET title = ?, updated_at = ?, message_count = ? WHERE id = ?',
      conversation.title, conversation.updatedAt, conversation.messageCount, conversation.id,
    ));
  }

  async deleteAiConversation(conversationId: string): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM ai_chat_messages WHERE conversation_id = ?', conversationId);
      await transaction.runAsync('DELETE FROM ai_conversations WHERE id = ?', conversationId);
    });
  }

  async listAiChatMessages(conversationId: string): Promise<AiChatMessage[]> {
    const rows = await this.db.getAllAsync<AiChatMessageRow>('SELECT * FROM ai_chat_messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC', conversationId);
    return rows.map(mapAiChatMessage);
  }

  async saveAiChatMessage(message: AiChatMessage): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO ai_chat_messages (id, conversation_id, role, text, question, failed, memory_count, sources_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET role = excluded.role, text = excluded.text, question = excluded.question,
         failed = excluded.failed, memory_count = excluded.memory_count, sources_json = excluded.sources_json`,
      message.id, message.conversationId, message.role, message.text, message.question,
      message.failed ? 1 : 0, message.memoryCount, JSON.stringify(message.sources), message.createdAt,
    ));
  }

  async clearAiConversations(): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM ai_chat_messages');
      await transaction.runAsync('DELETE FROM ai_conversations');
    });
  }

  async listKnowledgeSources(): Promise<KnowledgeSourceSignature[]> {
    const rows = await this.db.getAllAsync<KnowledgeSourceRow>('SELECT source_kind, source_id, content_hash, chunk_count, indexed_at FROM knowledge_sources');
    return rows.map((row) => ({
      sourceKind: row.source_kind as KnowledgeSourceKind,
      sourceId: row.source_id,
      contentHash: row.content_hash,
      chunkCount: row.chunk_count,
      indexedAt: row.indexed_at,
    }));
  }

  async replaceKnowledgeSource(input: { sourceKind: KnowledgeSourceKind; sourceId: string; contentHash: string; indexedAt: string; chunks: KnowledgeChunk[] }): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM knowledge_chunks WHERE source_kind = ? AND source_id = ?', input.sourceKind, input.sourceId);
      for (const chunk of input.chunks) {
        await transaction.runAsync(
          `INSERT INTO knowledge_chunks (id, source_kind, source_id, chunk_index, day_key, person_ids_json, tag_keys_json, title, context_prefix, body_text, char_start, char_end, is_private, token_estimate, content_hash, source_updated_at, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          chunk.id, chunk.sourceKind, chunk.sourceId, chunk.chunkIndex, chunk.dayKey, JSON.stringify(chunk.personIds), JSON.stringify(chunk.tagKeys),
          chunk.title, chunk.contextPrefix, chunk.bodyText, chunk.charStart, chunk.charEnd, chunk.isPrivate ? 1 : 0, chunk.tokenEstimate,
          chunk.contentHash, chunk.sourceUpdatedAt, chunk.indexedAt,
        );
      }
      await transaction.runAsync(
        `INSERT INTO knowledge_sources (source_kind, source_id, content_hash, chunk_count, indexed_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(source_kind, source_id) DO UPDATE SET content_hash = excluded.content_hash, chunk_count = excluded.chunk_count, indexed_at = excluded.indexed_at`,
        input.sourceKind, input.sourceId, input.contentHash, input.chunks.length, input.indexedAt,
      );
    });
  }

  async replaceKnowledgeSources(inputs: Array<{ sourceKind: KnowledgeSourceKind; sourceId: string; contentHash: string; indexedAt: string; chunks: KnowledgeChunk[] }>): Promise<void> {
    if (!inputs.length) return;
    await this.withTransaction(async (transaction) => {
      for (const input of inputs) {
        await transaction.runAsync('DELETE FROM knowledge_chunks WHERE source_kind = ? AND source_id = ?', input.sourceKind, input.sourceId);
        for (const chunk of input.chunks) {
          await transaction.runAsync(
            `INSERT INTO knowledge_chunks (id, source_kind, source_id, chunk_index, day_key, person_ids_json, tag_keys_json, title, context_prefix, body_text, char_start, char_end, is_private, token_estimate, content_hash, source_updated_at, indexed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            chunk.id, chunk.sourceKind, chunk.sourceId, chunk.chunkIndex, chunk.dayKey, JSON.stringify(chunk.personIds), JSON.stringify(chunk.tagKeys),
            chunk.title, chunk.contextPrefix, chunk.bodyText, chunk.charStart, chunk.charEnd, chunk.isPrivate ? 1 : 0, chunk.tokenEstimate,
            chunk.contentHash, chunk.sourceUpdatedAt, chunk.indexedAt,
          );
        }
        await transaction.runAsync(
          `INSERT INTO knowledge_sources (source_kind, source_id, content_hash, chunk_count, indexed_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(source_kind, source_id) DO UPDATE SET content_hash = excluded.content_hash, chunk_count = excluded.chunk_count, indexed_at = excluded.indexed_at`,
          input.sourceKind, input.sourceId, input.contentHash, input.chunks.length, input.indexedAt,
        );
      }
    });
  }

  async deleteKnowledgeSources(keys: Array<{ sourceKind: KnowledgeSourceKind; sourceId: string }>): Promise<void> {
    if (!keys.length) return;
    await this.withTransaction(async (transaction) => {
      for (const key of keys) {
        await transaction.runAsync('DELETE FROM knowledge_chunks WHERE source_kind = ? AND source_id = ?', key.sourceKind, key.sourceId);
        await transaction.runAsync('DELETE FROM knowledge_sources WHERE source_kind = ? AND source_id = ?', key.sourceKind, key.sourceId);
      }
    });
  }

  async searchKnowledgeFts(match: string, limit: number): Promise<KnowledgeChunk[]> {
    const rows = await this.db.getAllAsync<KnowledgeChunkRow & { rank: number }>(
      `SELECT c.*, bm25(knowledge_chunks_fts) AS rank FROM knowledge_chunks_fts
       JOIN knowledge_chunks c ON c.rowid = knowledge_chunks_fts.rowid
       WHERE knowledge_chunks_fts MATCH ? ORDER BY rank LIMIT ?`,
      match,
      limit,
    );
    return rows.map(mapKnowledgeChunk);
  }

  async searchKnowledgeLike(patterns: string[], limit: number): Promise<KnowledgeChunk[]> {
    if (!patterns.length) return [];
    const found = new Map<string, KnowledgeChunk>();
    for (const pattern of patterns) {
      const rows = await this.db.getAllAsync<KnowledgeChunkRow>(
        'SELECT * FROM knowledge_chunks WHERE body_text LIKE ? OR context_prefix LIKE ? OR title LIKE ? ORDER BY day_key DESC LIMIT ?',
        pattern,
        pattern,
        pattern,
        limit,
      );
      for (const row of rows) {
        if (found.size >= limit) break;
        if (!found.has(row.id)) found.set(row.id, mapKnowledgeChunk(row));
      }
    }
    return [...found.values()];
  }

  async saveKnowledgeAggregates(items: KnowledgeAggregate[]): Promise<void> {
    if (!items.length) return;
    await this.withTransaction(async (transaction) => {
      for (const item of items) {
        await transaction.runAsync(
          `INSERT INTO knowledge_aggregates (id, kind, scope_key, title, body_markdown, stats_json, source_refs_json, generator, model_id, source_revision, stale, generated_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(kind, scope_key, generator) DO UPDATE SET title = excluded.title, body_markdown = excluded.body_markdown, stats_json = excluded.stats_json,
             source_refs_json = excluded.source_refs_json, model_id = excluded.model_id, source_revision = excluded.source_revision, stale = excluded.stale, updated_at = excluded.updated_at`,
          item.id, item.kind, item.scopeKey, item.title, item.bodyMarkdown, item.statsJson, JSON.stringify(item.sourceRefs), item.generator, item.modelId,
          item.sourceRevision, item.stale ? 1 : 0, item.generatedAt, item.updatedAt,
        );
      }
    });
  }

  async listKnowledgeAggregates(): Promise<KnowledgeAggregate[]> {
    const rows = await this.db.getAllAsync<KnowledgeAggregateRow>('SELECT * FROM knowledge_aggregates ORDER BY kind, scope_key');
    return rows.map(mapKnowledgeAggregate);
  }

  async getKnowledgeState(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM knowledge_state WHERE key = ?', key);
    return row?.value ?? null;
  }

  async setKnowledgeState(key: string, value: string): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync('INSERT INTO knowledge_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value));
  }

  async clearKnowledgeIndex(): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.execAsync('DELETE FROM knowledge_chunks; DELETE FROM knowledge_sources; DELETE FROM knowledge_aggregates;');
    });
  }

  async listPostPersons(): Promise<Array<{ postId: string; personId: string }>> {
    const rows = await this.db.getAllAsync<{ post_id: string; person_id: string }>('SELECT post_id, person_id FROM post_persons ORDER BY post_id, person_id');
    return rows.map((row) => ({ postId: row.post_id, personId: row.person_id }));
  }

  async saveMemoryItem(item: MemoryItem): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `INSERT INTO memory_items (id, kind, subject_type, subject_id, content, confidence, importance, status, origin, valid_from, valid_to, recorded_at, last_confirmed_at, extraction_batch_id, last_used_at, use_count, content_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id, item.kind, item.subjectType, item.subjectId, item.content, item.confidence, item.importance, item.status, item.origin,
      item.validFrom, item.validTo, item.recordedAt, item.lastConfirmedAt, item.extractionBatchId, item.lastUsedAt, item.useCount,
      item.contentHash, item.createdAt, item.updatedAt,
    ));
  }

  async updateMemoryItem(item: MemoryItem): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      `UPDATE memory_items SET kind = ?, subject_type = ?, subject_id = ?, content = ?, confidence = ?, importance = ?, status = ?, origin = ?,
        valid_from = ?, valid_to = ?, last_confirmed_at = ?, extraction_batch_id = ?, last_used_at = ?, use_count = ?, content_hash = ?, updated_at = ?
       WHERE id = ?`,
      item.kind, item.subjectType, item.subjectId, item.content, item.confidence, item.importance, item.status, item.origin,
      item.validFrom, item.validTo, item.lastConfirmedAt, item.extractionBatchId, item.lastUsedAt, item.useCount, item.contentHash, item.updatedAt, item.id,
    ));
  }

  async listMemoryItems(): Promise<MemoryItem[]> {
    const rows = await this.db.getAllAsync<MemoryItemRow>('SELECT * FROM memory_items ORDER BY updated_at DESC');
    return rows.map(mapMemoryItem);
  }

  async getMemoryItem(memoryId: string): Promise<MemoryItem | null> {
    const row = await this.db.getFirstAsync<MemoryItemRow>('SELECT * FROM memory_items WHERE id = ?', memoryId);
    return row ? mapMemoryItem(row) : null;
  }

  async saveMemorySources(memoryId: string, sources: MemorySourceRef[]): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM memory_sources WHERE memory_id = ?', memoryId);
      for (const source of sources) {
        await transaction.runAsync('INSERT OR IGNORE INTO memory_sources (memory_id, source_kind, source_id) VALUES (?, ?, ?)', memoryId, source.sourceKind, source.sourceId);
      }
    });
  }

  async listMemorySources(): Promise<MemorySourceRow[]> {
    const rows = await this.db.getAllAsync<MemorySourceRowModel>('SELECT memory_id, source_kind, source_id FROM memory_sources ORDER BY memory_id');
    return rows.map((row) => ({ memoryId: row.memory_id, sourceKind: row.source_kind, sourceId: row.source_id }));
  }

  async saveMemoryRevision(revision: MemoryRevision): Promise<void> {
    await this.enqueueWrite(() => this.db.runAsync(
      'INSERT INTO memory_revisions (id, memory_id, action, before_json, after_json, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      revision.id, revision.memoryId, revision.action, revision.beforeJson, revision.afterJson, revision.reason, revision.createdAt,
    ));
  }

  async listMemoryRevisions(memoryId: string): Promise<MemoryRevision[]> {
    const rows = await this.db.getAllAsync<MemoryRevisionRowModel>('SELECT * FROM memory_revisions WHERE memory_id = ? ORDER BY created_at DESC', memoryId);
    return rows.map((row) => ({
      id: row.id, memoryId: row.memory_id, action: row.action, beforeJson: row.before_json, afterJson: row.after_json,
      reason: row.reason, createdAt: row.created_at,
    }));
  }

  async clearAllMemory(): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.execAsync('DELETE FROM memory_revisions; DELETE FROM memory_sources; DELETE FROM memory_items;');
    });
  }

  async exportBackupSnapshot(): Promise<BackupSnapshot> {
    const [checkInRows, ledgerTransactionRows, posts, draftRows, people, media, postPersonRows, settingRows, tagDefinitions, tagGroups, tagSystemSettings, personTags, personRelationshipNodes, personRelationships, personEvents, albums, albumMedia, personBooks, musicTracks, musicCollectionEntries, musicPlaylists, musicPlaylistEntries, bookLists, bookListEntries, books, bookExcerpts, readingNoteSources, memoryItemRows, memorySourceRows, memoryRevisionRows] = await Promise.all([
      this.db.getAllAsync<CheckInRow>('SELECT id, day_key, city, created_at FROM checkins ORDER BY day_key'),
      this.db.getAllAsync<LedgerTransactionRow>('SELECT id, type, amount_cents, category, day_key, note, created_at, updated_at FROM ledger_transactions ORDER BY day_key, created_at'),
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
      this.listPersonRelationshipNodes(),
      this.listPersonRelationships(),
      this.listPersonEvents(),
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
      this.db.getAllAsync<MemoryItemRow>("SELECT * FROM memory_items WHERE origin IN ('user', 'ai_auto') AND status <> 'deleted' ORDER BY created_at"),
      this.db.getAllAsync<MemorySourceRowModel>('SELECT memory_id, source_kind, source_id FROM memory_sources ORDER BY memory_id'),
      this.db.getAllAsync<MemoryRevisionRowModel>('SELECT * FROM memory_revisions ORDER BY memory_id, created_at'),
    ]);
    return {
      checkIns: checkInRows.map(mapCheckIn),
      ledgerTransactions: ledgerTransactionRows.map(mapLedgerTransaction),
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
      personRelationshipNodes,
      personRelationships,
      personEvents,
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
      memoryItems: memoryItemRows.map(mapMemoryItem),
      memorySources: memorySourceRows.map((row) => ({ memoryId: row.memory_id, sourceKind: row.source_kind, sourceId: row.source_id })),
      memoryRevisions: memoryRevisionRows.map((row) => ({ id: row.id, memoryId: row.memory_id, action: row.action, beforeJson: row.before_json, afterJson: row.after_json, reason: row.reason, createdAt: row.created_at })),
    };
  }

  async replaceFromBackup(snapshot: BackupSnapshot): Promise<void> {
    await this.withTransaction(async (transaction) => {
      await transaction.execAsync('DELETE FROM birthday_notification_schedules; DELETE FROM memory_notification_schedules; DELETE FROM reading_note_sources; DELETE FROM book_excerpts; DELETE FROM person_events; DELETE FROM person_books; DELETE FROM book_list_entries; DELETE FROM book_lists; DELETE FROM books; DELETE FROM music_playlist_entries; DELETE FROM music_playlists; DELETE FROM music_collection_entries; DELETE FROM music_tracks; DELETE FROM album_media; DELETE FROM person_albums; DELETE FROM person_tag_assignments; DELETE FROM person_relationships; DELETE FROM person_relationship_nodes; DELETE FROM tag_definitions; DELETE FROM tag_groups; DELETE FROM tag_system_settings; DELETE FROM memory_exposures; DELETE FROM post_persons; DELETE FROM ledger_transactions; DELETE FROM posts; DELETE FROM drafts; DELETE FROM checkins; DELETE FROM persons; DELETE FROM media; DELETE FROM settings; DELETE FROM memory_revisions; DELETE FROM memory_sources; DELETE FROM memory_items;');
      for (const checkIn of snapshot.checkIns) {
        await transaction.runAsync('INSERT INTO checkins (id, day_key, city, created_at) VALUES (?, ?, ?, ?)', checkIn.id, checkIn.dayKey, checkIn.city, checkIn.createdAt);
      }
      for (const item of snapshot.ledgerTransactions ?? []) {
        await transaction.runAsync('INSERT INTO ledger_transactions (id, type, amount_cents, category, day_key, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', item.id, item.type, item.amountCents, item.category, item.dayKey, item.note ?? null, item.createdAt, item.updatedAt);
      }
      for (const person of snapshot.people) {
        await transaction.runAsync(
          'INSERT INTO persons (id, name, nickname, bio, avatar_media_id, gender, relation_to_me, impression, birthday_calendar, birthday_year, birthday_month, birthday_day, birthday_is_leap_month, birthday_reminder_mode, birthday_reminder_enabled, birthday_reminder_hour, birthday_reminder_minute, contacts_json, custom_fields_json, important_dates_json, privacy_mode, memory_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          person.id, person.name, person.nickname, person.bio, person.avatarMediaId, person.gender, person.relationToMe, person.impression, person.birthday?.calendar ?? null, person.birthday?.year ?? null, person.birthday?.month ?? null, person.birthday?.day ?? null, person.birthday?.isLeapMonth ? 1 : 0, person.birthday?.reminderMode ?? null, person.birthday?.reminderEnabled === false ? 0 : 1, person.birthday?.reminderHour ?? null, person.birthday?.reminderMinute ?? null, JSON.stringify(person.contacts ?? []), JSON.stringify(person.customFields ?? {}), JSON.stringify(person.importantDates ?? []), person.privacyMode ?? 'normal', person.memoryEnabled ? 1 : 0, person.createdAt, person.updatedAt,
        );
      }
      for (const event of snapshot.personEvents ?? []) await transaction.runAsync('INSERT INTO person_events (id, person_id, title, description, time_text, participant_ids_json, pinned, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', event.id, event.personId, event.title, event.description ?? null, event.timeText ?? null, JSON.stringify(event.participantIds ?? []), event.pinned ? 1 : 0, event.sortOrder, event.createdAt, event.updatedAt);
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
          'INSERT INTO posts (id, day_key, body_markdown, location_name, pinned, created_at, updated_at, comments_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          post.id, post.dayKey, post.bodyMarkdown, post.locationName, post.pinned ? 1 : 0, post.createdAt, post.updatedAt, JSON.stringify(post.comments ?? []),
        );
      }
      for (const relation of snapshot.postPersons) {
        await transaction.runAsync('INSERT INTO post_persons (post_id, person_id) VALUES (?, ?)', relation.postId, relation.personId);
      }
      for (const group of snapshot.tagGroups ?? []) await transaction.runAsync('INSERT INTO tag_groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', group.id, group.name, group.createdAt, group.updatedAt);
      for (const tag of snapshot.tagDefinitions ?? []) await transaction.runAsync('INSERT INTO tag_definitions (id, name, normalized_name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', tag.id, tag.name, tag.normalizedName, tag.groupId ?? null, tag.createdAt, tag.updatedAt);
      for (const setting of snapshot.tagSystemSettings ?? defaultTagSystemSettings()) await transaction.runAsync('INSERT OR REPLACE INTO tag_system_settings (system, enabled, sort_order) VALUES (?, ?, ?)', setting.system, setting.enabled ? 1 : 0, setting.sortOrder);
      for (const relation of snapshot.personTags ?? []) await transaction.runAsync('INSERT INTO person_tag_assignments (person_id, kind, value) VALUES (?, ?, ?)', relation.personId, relation.kind, relation.value);
      for (const node of snapshot.personRelationshipNodes ?? []) await transaction.runAsync('INSERT INTO person_relationship_nodes (id, node_type, person_id, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', node.id, node.kind, node.personId, node.label, node.createdAt, node.updatedAt);
      for (const relationship of snapshot.personRelationships ?? []) await transaction.runAsync('INSERT INTO person_relationships (id, source_node_id, target_node_id, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', relationship.id, relationship.sourceNodeId, relationship.targetNodeId, relationship.kind, relationship.createdAt, relationship.updatedAt);
      for (const album of snapshot.albums ?? []) await transaction.runAsync('INSERT INTO person_albums (id, person_id, name, cover_media_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', album.id, album.personId, album.name, album.coverMediaId, album.sortOrder, album.createdAt, album.updatedAt);
      for (const relation of snapshot.albumMedia ?? []) await transaction.runAsync('INSERT INTO album_media (album_id, media_id, sort_order, added_at) VALUES (?, ?, ?, ?)', relation.albumId, relation.mediaId, relation.sortOrder, relation.addedAt);
      for (const track of snapshot.musicTracks ?? []) await transaction.runAsync('INSERT INTO music_tracks (id, media_id, cover_media_id, title, artist, album, duration_ms, quality, play_count, owner_type, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)', track.id, track.mediaId, track.coverMediaId ?? null, track.title, track.artist, track.album, track.durationMs, track.quality ?? null, track.playCount, 'unassigned', track.createdAt, track.updatedAt);
      for (const entry of snapshot.musicCollectionEntries ?? []) await transaction.runAsync('INSERT INTO music_collection_entries (track_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)', entry.trackId, entry.targetType, entry.targetId ?? '', entry.createdAt);
      for (const playlist of snapshot.musicPlaylists ?? []) await transaction.runAsync('INSERT INTO music_playlists (id, name, cover_media_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', playlist.id, playlist.name, playlist.coverMediaId ?? null, playlist.createdAt, playlist.updatedAt);
      for (const entry of snapshot.musicPlaylistEntries ?? []) await transaction.runAsync('INSERT INTO music_playlist_entries (playlist_id, track_id, added_at) VALUES (?, ?, ?)', entry.playlistId, entry.trackId, entry.addedAt);
      for (const book of snapshot.books ?? []) await transaction.runAsync('INSERT INTO books (id, file_media_id, cover_media_id, title, author, format, parse_status, parse_message, progress, last_read_at, location, location_type, chapter_href, chapter_title, engine_version, page_count, chapter_cache_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', book.id, book.fileMediaId, book.coverMediaId, book.title, book.author, book.format, book.parseStatus, book.parseMessage, book.progress, book.lastReadAt ?? null, book.location, book.locationType ?? null, book.chapterHref ?? null, book.chapterTitle ?? null, book.engineVersion ?? null, book.pageCount ?? null, JSON.stringify(book.chapterCache ?? []), book.createdAt, book.updatedAt);
      for (const list of snapshot.bookLists ?? []) await transaction.runAsync('INSERT INTO book_lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', list.id, list.name, list.createdAt, list.updatedAt);
      for (const entry of snapshot.bookListEntries ?? []) await transaction.runAsync('INSERT INTO book_list_entries (list_id, book_id, added_at) VALUES (?, ?, ?)', entry.listId, entry.bookId, entry.addedAt);
      for (const relation of snapshot.personBooks ?? []) await transaction.runAsync('INSERT INTO person_books (person_id, book_id, created_at) VALUES (?, ?, ?)', relation.personId, relation.bookId, relation.createdAt);
      for (const excerpt of snapshot.bookExcerpts ?? []) await transaction.runAsync('INSERT INTO book_excerpts (id, book_id, book_title, text, location, note, location_type, chapter_title, context_before, context_after, source_kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', excerpt.id, excerpt.bookId, excerpt.bookTitle ?? null, excerpt.text, excerpt.location, excerpt.note, excerpt.locationType ?? null, excerpt.chapterTitle ?? null, excerpt.contextBefore ?? null, excerpt.contextAfter ?? null, excerpt.sourceKind ?? 'manual', excerpt.createdAt);
      for (const source of snapshot.readingNoteSources ?? []) await transaction.runAsync('INSERT INTO reading_note_sources (post_id, book_id, excerpt_ids_json, quote_snapshots_json) VALUES (?, ?, ?, ?)', source.postId, source.bookId, JSON.stringify(source.excerptIds), JSON.stringify(source.quoteSnapshots));
      for (const item of snapshot.memoryItems ?? []) {
        await transaction.runAsync(
          `INSERT INTO memory_items (id, kind, subject_type, subject_id, content, confidence, importance, status, origin, valid_from, valid_to, recorded_at, last_confirmed_at, extraction_batch_id, last_used_at, use_count, content_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.id, item.kind, item.subjectType, item.subjectId, item.content, item.confidence, item.importance, item.status, item.origin,
          item.validFrom, item.validTo, item.recordedAt, item.lastConfirmedAt, item.extractionBatchId, item.lastUsedAt, item.useCount,
          item.contentHash, item.createdAt, item.updatedAt,
        );
      }
      for (const source of snapshot.memorySources ?? []) {
        await transaction.runAsync('INSERT OR IGNORE INTO memory_sources (memory_id, source_kind, source_id) VALUES (?, ?, ?)', source.memoryId, source.sourceKind, source.sourceId);
      }
      for (const revision of snapshot.memoryRevisions ?? []) {
        await transaction.runAsync('INSERT OR IGNORE INTO memory_revisions (id, memory_id, action, before_json, after_json, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', revision.id, revision.memoryId, revision.action, revision.beforeJson, revision.afterJson, revision.reason, revision.createdAt);
      }
      for (const [key, value] of Object.entries(snapshot.settings)) {
        await transaction.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', key, value);
      }
    });
  }
}

function mapAiProviderProfile(row: AiProviderProfileRow): AiProviderProfile {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    baseUrl: row.base_url,
    modelId: row.model_id,
    keyHint: row.key_hint,
    supportsStream: row.supports_stream === 1,
    supportsBalance: row.supports_balance === 1,
    enabled: row.enabled === 1,
    isDefault: row.is_default === 1,
    lastProbeAt: row.last_probe_at,
    lastProbeStatus: parseProbeStatus(row.last_probe_status),
    lastProbeLatencyMs: row.last_probe_latency_ms,
    lastProbeMessage: row.last_probe_message,
    modelsJson: row.models_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseProbeStatus(value: string | null): AiProviderProfile['lastProbeStatus'] {
  return value === 'ok' || value === 'auth_failed' || value === 'network_failed' || value === 'model_missing' || value === 'unsupported' || value === 'unknown'
    ? value
    : null;
}

function mapAiUsageRecord(row: AiUsageRecordRow): AiUsageRecord {
  return {
    id: row.id,
    providerId: row.provider_id,
    providerKind: row.provider_kind,
    modelId: row.model_id,
    taskId: parseAiUsageTaskId(row.task_id),
    status: row.status,
    errorCode: parseAiErrorCode(row.error_code),
    inputTokens: row.input_tokens,
    cachedInputTokens: row.cached_input_tokens,
    outputTokens: row.output_tokens,
    durationMs: row.duration_ms,
    estimatedCostMicros: row.estimated_cost_micros,
    currency: row.currency === 'CNY' || row.currency === 'USD' ? row.currency : null,
    createdAt: row.created_at,
  };
}

function parseAiUsageTaskId(value: string): AiUsageTaskId {
  return (AI_USAGE_TASK_IDS as readonly string[]).includes(value) ? (value as AiUsageTaskId) : 'unknown';
}

function parseAiErrorCode(value: string | null): AiUsageRecord['errorCode'] {
  return value === 'auth_failed' || value === 'insufficient_balance' || value === 'model_missing' || value === 'rate_limited'
    || value === 'provider_error' || value === 'timeout' || value === 'cancelled' || value === 'network_failed'
    || value === 'invalid_config' || value === 'unsupported' || value === 'unknown'
    ? value
    : null;
}

function mapAiConversation(row: AiConversationRow): AiConversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
  };
}

function mapAiChatMessage(row: AiChatMessageRow): AiChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    text: row.text,
    question: row.question,
    failed: row.failed === 1,
    memoryCount: row.memory_count,
    sources: parseAiConversationSources(row.sources_json),
    createdAt: row.created_at,
  };
}

function parseAiConversationSources(value: string | null): AiConversationSource[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.citationId !== 'string' || typeof candidate.title !== 'string') return [];
      return [{
        citationId: candidate.citationId,
        title: candidate.title,
        route: typeof candidate.route === 'string' ? candidate.route : '',
        dayKey: typeof candidate.dayKey === 'string' ? candidate.dayKey : null,
        personNames: Array.isArray(candidate.personNames) ? candidate.personNames.filter((name): name is string => typeof name === 'string') : [],
        ...(candidate.origin === 'me' || candidate.origin === 'people' ? { origin: candidate.origin } : {}),
      }];
    });
  } catch {
    return [];
  }
}

function mapKnowledgeChunk(row: KnowledgeChunkRow): KnowledgeChunk {
  return {
    id: row.id,
    sourceKind: row.source_kind as KnowledgeSourceKind,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    dayKey: (row.day_key as KnowledgeChunk['dayKey']) ?? null,
    personIds: parseJsonStringList(row.person_ids_json),
    tagKeys: parseJsonStringList(row.tag_keys_json),
    title: row.title ?? '',
    contextPrefix: row.context_prefix,
    bodyText: row.body_text,
    charStart: row.char_start,
    charEnd: row.char_end,
    isPrivate: row.is_private === 1,
    tokenEstimate: row.token_estimate,
    contentHash: row.content_hash,
    sourceUpdatedAt: row.source_updated_at,
    indexedAt: row.indexed_at,
  };
}

function mapKnowledgeAggregate(row: KnowledgeAggregateRow): KnowledgeAggregate {
  let refs: KnowledgeAggregate['sourceRefs'] = [];
  try {
    const parsed = JSON.parse(row.source_refs_json) as unknown;
    if (Array.isArray(parsed)) refs = parsed.flatMap((item) => (item && typeof item === 'object' && 'kind' in item && 'id' in item && typeof item.kind === 'string' && typeof item.id === 'string' ? [{ kind: item.kind, id: item.id }] : []));
  } catch {
    refs = [];
  }
  return {
    id: row.id,
    kind: row.kind as KnowledgeAggregate['kind'],
    scopeKey: row.scope_key,
    title: row.title,
    bodyMarkdown: row.body_markdown,
    statsJson: row.stats_json,
    sourceRefs: refs,
    generator: row.generator as AggregateGenerator,
    modelId: row.model_id,
    sourceRevision: row.source_revision,
    stale: row.stale === 1,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

function mapMemoryItem(row: MemoryItemRow): MemoryItem {
  return {
    id: row.id,
    kind: row.kind as MemoryKind,
    subjectType: row.subject_type as MemorySubjectType,
    subjectId: row.subject_id,
    content: row.content,
    confidence: row.confidence,
    importance: (row.importance === 1 || row.importance === 3 ? row.importance : 2) as MemoryItem['importance'],
    status: row.status as MemoryStatus,
    origin: row.origin as MemoryOrigin,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    recordedAt: row.recorded_at,
    lastConfirmedAt: row.last_confirmed_at,
    extractionBatchId: row.extraction_batch_id,
    lastUsedAt: row.last_used_at,
    useCount: row.use_count,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseJsonStringList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
