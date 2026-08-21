import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { BACKUP_SCHEMA_VERSION } from './backup-contract';
import type { BackupManifest } from './backup-contract';
import type { MusicTrack } from '@still-alive/types';
import type { BackupSnapshot } from '../../infrastructure/database/database-models';
import { createAudioEmbed, extractAudioEmbeds, formatAudioDuration } from '../journal/embedded-media';
import { unlockPasswordVault } from '../vault/password-vault-crypto';
import { parsePasswordVaultBytes, passwordVaultExists, readPasswordVaultBytes, readPasswordVaultEnvelope, replacePasswordVaultEnvelope } from '../vault/password-vault-storage';
import { logPasswordVaultDiagnostic, passwordVaultErrorKind } from '../vault/password-vault-logging';

const APP_VERSION = '0.1.0';
const MAX_BACKUP_ARCHIVE_BYTES = 128 * 1024 * 1024;
const MAX_BACKUP_EXPANDED_BYTES = 256 * 1024 * 1024;
const MAX_BACKUP_ENTRY_COUNT = 20_000;

export interface BackupArchive {
  uri: string;
  size: number;
}

export interface ParsedBackup {
  exportedAt: string;
  snapshot: BackupSnapshot;
  entries: Record<string, Uint8Array>;
  vaultEnvelope: Uint8Array | null;
}

export interface MaterializedBackup {
  snapshot: BackupSnapshot;
  createdFiles: string[];
  createdDirectories: string[];
}

export async function createBackupArchive(snapshot: BackupSnapshot): Promise<BackupArchive> {
  const entries: Record<string, Uint8Array> = {};
  const portableMedia: BackupSnapshot['media'] = [];

  const albumByMedia = new Map((snapshot.albumMedia ?? []).map((relation) => [relation.mediaId, (snapshot.albums ?? []).find((album) => album.id === relation.albumId)]));
  for (const item of snapshot.media) {
    const source = new File(item.localPath);
    if (!source.exists) throw new Error(`本地媒体缺失：${item.id}`);
    const album = albumByMedia.get(item.id);
    const path = album ? `${album.personId ? `people/${album.personId}` : 'self'}/albums/${album.id}/${item.id}${source.extension || '.bin'}` : `${item.kind === 'book' ? 'books' : item.kind === 'audio' ? 'music' : 'media'}/${item.id}${source.extension || '.bin'}`;
    entries[path] = await source.bytes();
    portableMedia.push({ ...item, localPath: path });
  }

  const portableSnapshot: BackupSnapshot = { ...snapshot, media: portableMedia };
  entries['data.json'] = strToU8(JSON.stringify(portableSnapshot, null, 2));
  const vaultEnvelope = await readPasswordVaultBytes();
  if (vaultEnvelope) {
    logPasswordVaultDiagnostic('backup.export.include-vault', { bytes: vaultEnvelope.byteLength });
    entries['vault.enc'] = vaultEnvelope;
  }
  for (const post of snapshot.posts) {
    const portableMarkdown = post.bodyMarkdown.replace(/!\[语音\]\(audio:\/\/([^)?]+)(?:\?duration=(\d+))?\)/g, (token, id: string, duration: string | undefined) => {
      const audio = portableMedia.find((item) => item.id === id);
      return audio ? `[语音记录（${formatAudioDuration(Number(duration ?? 0))}）](../${audio.localPath})` : token;
    });
    const locationLine = post.locationName ? `地点：${post.locationName}\n\n` : '';
    entries[`markdown/${post.dayKey}_${post.id}.md`] = strToU8(`# ${post.dayKey}\n\n${locationLine}${portableMarkdown}\n`);
  }

  const files = [];
  for (const [path, bytes] of Object.entries(entries)) files.push({ path, checksum: await checksum(bytes) });
  const manifest: BackupManifest = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    files,
  };
  entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

  const bytes = zipSync(entries, { level: 6 });
  const output = new File(Paths.cache, `still-alive-${manifest.exportedAt.slice(0, 10)}.zip`);
  output.create({ overwrite: true });
  output.write(bytes);
  return { uri: output.uri, size: bytes.byteLength };
}

export async function parseBackupArchive(uri: string): Promise<ParsedBackup> {
  logPasswordVaultDiagnostic('backup.parse.start');
  const archive = new File(uri);
  if (!archive.exists || archive.size > MAX_BACKUP_ARCHIVE_BYTES) throw new Error('备份文件过大，无法安全读取');
  const archiveBytes = await archive.bytes();
  if (archiveBytes.byteLength > MAX_BACKUP_ARCHIVE_BYTES) throw new Error('备份文件过大，无法安全读取');
  const entries = unzipBackupArchive(archiveBytes);
  logPasswordVaultDiagnostic('backup.parse.unzipped', { archiveBytes: archiveBytes.byteLength, entries: Object.keys(entries).length });
  const manifestBytes = entries['manifest.json'];
  const dataBytes = entries['data.json'];
  if (!manifestBytes || !dataBytes) throw new Error('备份缺少 manifest.json 或 data.json');

  const manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest;
  if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1 || manifest.schemaVersion > BACKUP_SCHEMA_VERSION) throw new Error(`不支持的备份版本：${manifest.schemaVersion}`);
  if (!Array.isArray(manifest.files)) throw new Error('备份清单格式无效');
  for (const path of Object.keys(entries)) if (!isSafeRelativePath(path)) throw new Error(`备份文件路径无效：${path}`);
  const manifestPaths = new Set<string>();
  for (const item of manifest.files) {
    if (!item || typeof item.path !== 'string' || typeof item.checksum !== 'string' || !isSafeRelativePath(item.path) || manifestPaths.has(item.path)) throw new Error('备份清单格式无效');
    manifestPaths.add(item.path);
    const bytes = entries[item.path];
    if (!bytes) throw new Error(`备份文件缺失：${item.path}`);
    if (await checksum(bytes) !== item.checksum) throw new Error(`备份文件校验失败：${item.path}`);
  }

  const snapshot = JSON.parse(strFromU8(dataBytes)) as BackupSnapshot;
  migrateSnapshot(snapshot);
  validateSnapshot(snapshot);
  const vaultEnvelope = entries['vault.enc'] ?? null;
  if (vaultEnvelope) {
    if (!manifestPaths.has('vault.enc')) throw new Error('备份中的密码本未列入清单');
    parsePasswordVaultBytes(vaultEnvelope);
  }
  return { exportedAt: manifest.exportedAt, snapshot, entries, vaultEnvelope };
}

function unzipBackupArchive(bytes: Uint8Array): Record<string, Uint8Array> {
  let entryCount = 0;
  let expandedBytes = 0;
  const paths = new Set<string>();
  return unzipSync(bytes, {
    filter: ({ name, originalSize }) => {
      entryCount += 1;
      if (entryCount > MAX_BACKUP_ENTRY_COUNT) throw new Error('备份包含过多文件，无法安全读取');
      if (!isSafeRelativePath(name) || paths.has(name)) throw new Error(`备份文件路径无效：${name}`);
      if (!Number.isSafeInteger(originalSize) || originalSize < 0) throw new Error('备份文件大小无效');
      paths.add(name);
      expandedBytes += originalSize;
      if (!Number.isSafeInteger(expandedBytes) || expandedBytes > MAX_BACKUP_EXPANDED_BYTES) throw new Error('备份解压后过大，无法安全读取');
      return true;
    },
  });
}

export function backupContainsPasswordVault(parsed: ParsedBackup): boolean {
  return parsed.vaultEnvelope !== null;
}

export function localPasswordVaultExists(): boolean {
  return passwordVaultExists();
}

export async function restorePasswordVaultFromBackup(parsed: ParsedBackup, backupMasterPassword: string, currentMasterPassword: string | null): Promise<void> {
  logPasswordVaultDiagnostic('backup.restore-vault.start', { hasCurrentVault: passwordVaultExists() });
  const bytes = parsed.vaultEnvelope;
  if (!bytes) throw new Error('这个备份不包含密码本');
  const backupEnvelope = parsePasswordVaultBytes(bytes);
  const backupSession = await unlockPasswordVault(backupEnvelope, backupMasterPassword);
  try {
    if (passwordVaultExists()) {
      if (currentMasterPassword === null) throw new Error('请输入当前密码本的主密码');
      const currentSession = await unlockPasswordVault(await readPasswordVaultEnvelope(), currentMasterPassword);
      currentSession.dek.fill(0);
    }
    await replacePasswordVaultEnvelope(bytes, async (saved) => {
      const verified = await unlockPasswordVault(saved, backupMasterPassword);
      verified.dek.fill(0);
    });
    logPasswordVaultDiagnostic('backup.restore-vault.success');
  } catch (cause) {
    logPasswordVaultDiagnostic('backup.restore-vault.failed', { error: passwordVaultErrorKind(cause) });
    throw cause;
  } finally {
    backupSession.dek.fill(0);
  }
}

export function materializeBackupMedia(parsed: ParsedBackup): MaterializedBackup {
  const directory = new Directory(Paths.document, `media-restored-${Date.now()}`);
  directory.create({ intermediates: true });
  const createdFiles: string[] = [];
  const createdDirectories = [directory.uri];
  try {
    const restoredMedia = parsed.snapshot.media.map((item) => {
      const path = item.localPath;
      const bytes = parsed.entries[path];
      if (!bytes) throw new Error(`备份图片缺失：${path}`);
      const fileName = path.split('/').pop();
      if (!fileName) throw new Error(`备份图片路径无效：${path}`);
      const parts = path.split('/');
      let targetDirectory = directory;
      if (parts[0] === 'people' && parts.length === 5 && parts[2] === 'albums') {
        targetDirectory = new Directory(Paths.document, 'people', parts[1], 'albums', parts[3]);
      } else if (parts[0] === 'self' && parts.length === 4 && parts[1] === 'albums') {
        targetDirectory = new Directory(Paths.document, 'self', 'albums', parts[2]);
      } else if (parts[0] === 'books') {
        targetDirectory = new Directory(Paths.document, 'books');
      } else if (parts[0] === 'music') {
        targetDirectory = new Directory(Paths.document, 'media');
      }
      if (targetDirectory !== directory) {
        const existed = targetDirectory.exists;
        targetDirectory.create({ idempotent: true, intermediates: true });
        if (!existed) createdDirectories.push(targetDirectory.uri);
      }
      if (targetDirectory === directory && (parts[0] === 'books' || parts[0] === 'music')) {
        targetDirectory = new Directory(Paths.document, parts[0] === 'books' ? 'books' : 'media');
        const existed = targetDirectory.exists;
        targetDirectory.create({ idempotent: true, intermediates: true });
        if (!existed) createdDirectories.push(targetDirectory.uri);
      }
      const destination = new File(targetDirectory, fileName);
      if (destination.exists) {
        if (!equalBytes(destination.bytesSync(), bytes)) throw new Error(`本机存在不同内容的同名图片：${path}`);
      } else {
        destination.create();
        destination.write(bytes);
        createdFiles.push(destination.uri);
      }
      return { ...item, localPath: destination.uri };
    });
    return { snapshot: { ...parsed.snapshot, media: restoredMedia }, createdFiles, createdDirectories };
  } catch (cause) {
    cleanupMaterializedFiles(createdFiles, createdDirectories);
    throw cause;
  }
}

export function removeMaterializedMedia(materialized: MaterializedBackup): void {
  cleanupMaterializedFiles(materialized.createdFiles, materialized.createdDirectories);
}

function validateSnapshot(value: BackupSnapshot): void {
  if (!value || typeof value !== 'object') throw new Error('备份数据格式无效');
  const collections = ['checkIns', 'posts', 'drafts', 'people', 'media', 'postPersons', 'tagDefinitions', 'tagGroups', 'tagSystemSettings', 'personTags', 'albums', 'albumMedia'] as const;
  for (const key of collections) if (!Array.isArray(value[key])) throw new Error(`备份数据缺少 ${key}`);

  assertUniqueIds(value.posts, '日记');
  assertUniqueIds(value.people, '人物');
  assertUniqueIds(value.media, '媒体');
  const tagDefinitions = value.tagDefinitions ?? [];
  const tagGroups = value.tagGroups ?? [];
  const tagSystemSettings = value.tagSystemSettings ?? [];
  const personTags = value.personTags ?? [];
  const albums = value.albums ?? [];
  const albumMedia = value.albumMedia ?? [];
  const musicTracks = value.musicTracks ?? [];
  const musicCollectionEntries = value.musicCollectionEntries ?? [];
  const musicPlaylists = value.musicPlaylists ?? [];
  const musicPlaylistEntries = value.musicPlaylistEntries ?? [];
  const books = value.books ?? [];
  const bookExcerpts = value.bookExcerpts ?? [];
  const readingNoteSources = value.readingNoteSources ?? [];
  assertUniqueIds(tagDefinitions, '标签');
  assertUniqueIds(tagGroups, '标签组');
  assertUniqueIds(albums, '相册');
  assertUniqueIds(musicTracks, '音乐曲目');
  assertUniqueIds(musicPlaylists, '音乐歌单');
  assertUniqueIds(books, '书籍');
  assertUniqueIds(bookExcerpts, '摘抄');
  const tagSystems = new Set<string>();
  for (const setting of tagSystemSettings) {
    if (!['mbti', 'constellation', 'zodiac', 'custom'].includes(setting.system) || typeof setting.enabled !== 'boolean' || !Number.isInteger(setting.sortOrder) || tagSystems.has(setting.system)) throw new Error('备份中的标签体系设置无效');
    tagSystems.add(setting.system);
  }
  const postIds = new Set(value.posts.map((post) => post.id));
  const personIds = new Set(value.people.map((person) => person.id));
  const mediaIds = new Set(value.media.map((item) => item.id));
  const bookIds = new Set(books.map((book) => book.id));
  const excerptIds = new Set(bookExcerpts.map((excerpt) => excerpt.id));
  const musicTrackIds = new Set(musicTracks.map((track) => track.id));
  const musicPlaylistIds = new Set(musicPlaylists.map((playlist) => playlist.id));
  for (const track of musicTracks) {
    if (!mediaIds.has(track.mediaId) || !value.media.find((item) => item.id === track.mediaId)?.mimeType.startsWith('audio/')) throw new Error('备份中的音乐文件关联无效');
    if (track.coverMediaId && !mediaIds.has(track.coverMediaId)) throw new Error('备份中的音乐封面关联无效');
  }
  const collectionKeys = new Set<string>();
  for (const entry of musicCollectionEntries) {
    const key = `${entry.trackId}:${entry.targetType}:${entry.targetId ?? ''}`;
    if (!musicTrackIds.has(entry.trackId) || !['self', 'person'].includes(entry.targetType) || (entry.targetType === 'self' && entry.targetId !== null) || (entry.targetType === 'person' && (!entry.targetId || !personIds.has(entry.targetId))) || collectionKeys.has(key)) throw new Error('备份中的音乐收藏关系无效');
    collectionKeys.add(key);
  }
  for (const playlist of musicPlaylists) {
    if (!playlist.name.trim() || playlist.name.length > 40) throw new Error('备份中的音乐歌单无效');
    if (playlist.coverMediaId && !mediaIds.has(playlist.coverMediaId)) throw new Error('备份中的歌单封面关联无效');
  }
  const playlistEntryKeys = new Set<string>();
  for (const entry of musicPlaylistEntries) {
    const key = `${entry.playlistId}:${entry.trackId}`;
    if (!musicPlaylistIds.has(entry.playlistId) || !musicTrackIds.has(entry.trackId) || playlistEntryKeys.has(key)) throw new Error('备份中的歌单歌曲关联无效');
    playlistEntryKeys.add(key);
  }
  for (const book of books) {
    if (!mediaIds.has(book.fileMediaId) || !value.media.find((item) => item.id === book.fileMediaId)?.kind?.includes('book')) throw new Error('备份中的书籍文件关联无效');
    if (book.coverMediaId && !mediaIds.has(book.coverMediaId)) throw new Error('备份中的书籍封面关联无效');
    if (!['pdf', 'epub', 'mobi', 'azw', 'azw3'].includes(book.format) || !['ready', 'protected', 'unsupported', 'failed'].includes(book.parseStatus)) throw new Error('备份中的书籍格式或解析状态无效');
    if (!Number.isFinite(book.progress) || book.progress < 0 || book.progress > 1) throw new Error('备份中的阅读进度无效');
    if (book.locationType && !['epub-cfi', 'pdf-page', 'manual'].includes(book.locationType)) throw new Error('备份中的书籍定位类型无效');
    if (book.pageCount != null && (!Number.isInteger(book.pageCount) || book.pageCount < 1)) throw new Error('备份中的 PDF 页数无效');
    if (book.chapterCache && (!Array.isArray(book.chapterCache) || book.chapterCache.some((item) => !item || typeof item.href !== 'string' || typeof item.label !== 'string' || !Number.isInteger(item.depth)))) throw new Error('备份中的书籍目录无效');
  }
  for (const excerpt of bookExcerpts) if (!bookIds.has(excerpt.bookId) || !excerpt.text.trim() || excerpt.text.length > 20_000 || (excerpt.locationType && !['epub-cfi', 'pdf-page', 'manual'].includes(excerpt.locationType)) || (excerpt.sourceKind && !['selection', 'manual'].includes(excerpt.sourceKind))) throw new Error('备份中的摘抄无效');
  for (const source of readingNoteSources) {
    if (!postIds.has(source.postId) || (source.bookId && !bookIds.has(source.bookId)) || source.excerptIds.some((id) => !excerptIds.has(id)) || !Array.isArray(source.quoteSnapshots)) throw new Error('备份中的阅读笔记引用无效');
  }
  for (const checkIn of value.checkIns) if (checkIn.city !== null && (typeof checkIn.city !== 'string' || checkIn.city.length > 40)) throw new Error('备份中的打卡城市无效');
  for (const post of value.posts) {
    if (post.locationName !== null && (typeof post.locationName !== 'string' || post.locationName.length > 80)) throw new Error('备份中的记录地点无效');
    validateAudioEmbeds(post.bodyMarkdown, value.media, mediaIds);
  }
  for (const draft of value.drafts) validateAudioEmbeds(draft.bodyMarkdown, value.media, mediaIds);
  for (const relation of value.postPersons) {
    if (!postIds.has(relation.postId) || !personIds.has(relation.personId)) throw new Error('备份中的人物关联无效');
  }
  for (const person of value.people) {
    if (person.avatarMediaId && !mediaIds.has(person.avatarMediaId)) throw new Error('备份中的人物头像关联无效');
    if (person.gender && !['female', 'male', 'other'].includes(person.gender)) throw new Error('备份中的人物性别无效');
    if (person.birthday && !['solar', 'lunar', 'both'].includes(person.birthday.reminderMode)) throw new Error('备份中的生日提醒方式无效');
    if (person.birthday && (typeof person.birthday.reminderEnabled !== 'boolean' || !validReminderTime(person.birthday.reminderHour, person.birthday.reminderMinute))) throw new Error('备份中的生日提醒设置无效');
  }
  if (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) value.settings = {};
  for (const setting of Object.values(value.settings)) if (typeof setting !== 'string') throw new Error('备份中的设置数据无效');

  const tagIds = new Set(tagDefinitions.map((tag) => tag.id));
  const tagGroupIds = new Set(tagGroups.map((group) => group.id));
  for (const tag of tagDefinitions) if (tag.groupId && !tagGroupIds.has(tag.groupId)) throw new Error('备份中的标签组关联无效');
  const albumIds = new Set(albums.map((album) => album.id));
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const albumRelationByMedia = new Map<string, (typeof albumMedia)[number]>();
  for (const relation of albumMedia) {
    if (!albumIds.has(relation.albumId) || !mediaIds.has(relation.mediaId) || albumRelationByMedia.has(relation.mediaId)) throw new Error('备份中的相册照片关联无效');
    albumRelationByMedia.set(relation.mediaId, relation);
  }
  for (const album of albums) {
    if (album.personId !== null && !personIds.has(album.personId)) throw new Error('备份中的相册归属无效');
    if (album.coverMediaId && albumRelationByMedia.get(album.coverMediaId)?.albumId !== album.id) throw new Error('备份中的相册封面关联无效');
  }
  const mediaPaths = new Set<string>();
  for (const item of value.media) {
    if (!isSafeRelativePath(item.localPath) || mediaPaths.has(item.localPath)) throw new Error('备份中的媒体路径无效');
    mediaPaths.add(item.localPath);
    const relation = albumRelationByMedia.get(item.id);
    const album = relation ? albumById.get(relation.albumId) : undefined;
    const expectedPrefix = album ? `${album.personId ? `people/${album.personId}` : 'self'}/albums/${album.id}/` : `${item.kind === 'book' ? 'books' : item.kind === 'audio' ? 'music' : 'media'}/`;
    const fileName = item.localPath.slice(expectedPrefix.length);
    if (!item.localPath.startsWith(expectedPrefix) || !fileName.startsWith(`${item.id}.`) || fileName.length <= item.id.length + 1 || fileName.includes('/')) throw new Error('备份中的媒体路径与相册关联不一致');
  }
  for (const relation of personTags) if (!personIds.has(relation.personId) || (relation.kind !== 'mbti' && relation.kind !== 'custom') || (relation.kind === 'custom' && !tagIds.has(relation.value))) throw new Error('备份中的人物标签关联无效');
}

function migrateSnapshot(value: BackupSnapshot): void {
  if (!value || typeof value !== 'object') return;
  value.tagDefinitions ??= [];
  value.tagGroups ??= [];
  for (const tag of value.tagDefinitions) tag.groupId ??= null;
  value.tagSystemSettings ??= [
    { system: 'mbti', enabled: true, sortOrder: 0 },
    { system: 'constellation', enabled: true, sortOrder: 1 },
    { system: 'zodiac', enabled: true, sortOrder: 2 },
    { system: 'custom', enabled: true, sortOrder: 3 },
  ];
  value.personTags ??= [];
  value.albums ??= [];
  value.albumMedia ??= [];
  value.musicTracks ??= [];
  value.musicCollectionEntries ??= [];
  value.musicPlaylists ??= [];
  value.musicPlaylistEntries ??= [];
  for (const track of value.musicTracks) track.coverMediaId ??= null;
  for (const playlist of value.musicPlaylists) playlist.coverMediaId ??= null;
  for (const track of value.musicTracks as Array<MusicTrack & { ownerType?: string; ownerId?: string | null }>) {
    if ((track.ownerType === 'self' || track.ownerType === 'person') && !value.musicCollectionEntries.some((entry) => entry.trackId === track.id && entry.targetType === track.ownerType && entry.targetId === (track.ownerId ?? null))) value.musicCollectionEntries.push({ trackId: track.id, targetType: track.ownerType, targetId: track.ownerType === 'person' ? track.ownerId ?? null : null, createdAt: track.createdAt });
    if (!value.musicCollectionEntries.some((entry) => entry.trackId === track.id && entry.targetType === 'self')) value.musicCollectionEntries.push({ trackId: track.id, targetType: 'self', targetId: null, createdAt: track.createdAt });
    delete track.ownerType;
    delete track.ownerId;
  }
  value.books ??= [];
  value.bookExcerpts ??= [];
  value.readingNoteSources ??= [];
  for (const book of value.books) {
    if (book.format === 'pdf' && book.location?.match(/^page:\d+$/)) book.location = book.location.replace(/^page:/, 'pdf:');
    book.locationType ??= book.format === 'pdf' ? 'pdf-page' : book.location?.startsWith('epubcfi(') ? 'epub-cfi' : null;
    book.chapterHref ??= null;
    book.chapterTitle ??= null;
    book.engineVersion ??= null;
    book.pageCount ??= null;
    book.chapterCache ??= [];
  }
  for (const excerpt of value.bookExcerpts) {
    if (excerpt.location?.match(/^page:\d+$/)) excerpt.location = excerpt.location.replace(/^page:/, 'pdf:');
    excerpt.locationType ??= excerpt.location?.startsWith('pdf:') ? 'pdf-page' : excerpt.location?.startsWith('epubcfi(') ? 'epub-cfi' : 'manual';
    excerpt.chapterTitle ??= null;
    excerpt.contextBefore ??= null;
    excerpt.contextAfter ??= null;
    excerpt.sourceKind ??= 'manual';
  }
  for (const media of value.media ?? []) {
    media.kind ??= media.mimeType.startsWith('audio/') ? 'audio' : 'image';
    media.originalName ??= null;
    media.sizeBytes ??= null;
  }
  if (Array.isArray(value.people)) for (const person of value.people) {
    person.gender ??= null;
    person.birthday ??= null;
    if (person.birthday) {
      person.birthday.reminderMode ??= person.birthday.calendar;
      person.birthday.reminderEnabled ??= true;
      person.birthday.reminderHour ??= null;
      person.birthday.reminderMinute ??= null;
    }
  }
  if (Array.isArray(value.checkIns)) for (const checkIn of value.checkIns) checkIn.city ??= null;
  if (Array.isArray(value.posts)) for (const post of value.posts) {
    post.locationName ??= null;
    migrateLegacyAudio(post);
  }
  if (Array.isArray(value.drafts)) for (const draft of value.drafts) migrateLegacyAudio(draft);
}

function validReminderTime(hour: number | null, minute: number | null): boolean {
  if (hour === null || minute === null) return hour === null && minute === null;
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isInteger(minute) && minute >= 0 && minute <= 59;
}

function migrateLegacyAudio(value: { bodyMarkdown: string; audioMediaId?: unknown; audioDurationMs?: unknown }): void {
  const audioMediaId = typeof value.audioMediaId === 'string' ? value.audioMediaId : null;
  const audioDurationMs = typeof value.audioDurationMs === 'number' ? value.audioDurationMs : 0;
  if (audioMediaId && !extractAudioEmbeds(value.bodyMarkdown).some((item) => item.id === audioMediaId)) {
    value.bodyMarkdown = [value.bodyMarkdown.trim(), createAudioEmbed(audioMediaId, audioDurationMs)].filter(Boolean).join('\n\n');
  }
  delete value.audioMediaId;
  delete value.audioDurationMs;
}

function validateAudioEmbeds(markdown: string, media: BackupSnapshot['media'], mediaIds: Set<string>): void {
  for (const audio of extractAudioEmbeds(markdown)) {
    if (!mediaIds.has(audio.id) || !media.find((item) => item.id === audio.id)?.mimeType.startsWith('audio/')) throw new Error('备份中的语音引用无效');
  }
}

async function checksum(bytes: Uint8Array): Promise<string> {
  const data = new Uint8Array(bytes.byteLength);
  data.set(bytes);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function assertUniqueIds(items: { id: string }[], label: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error(`备份中的${label}标识无效`);
    ids.add(item.id);
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

function cleanupMaterializedFiles(files: string[], directories: string[]): void {
  for (const path of files) {
    const file = new File(path);
    if (file.exists) file.delete();
  }
  for (const path of [...directories].reverse()) {
    const directory = new Directory(path);
    if (directory.exists && directory.list().length === 0) directory.delete();
  }
}
