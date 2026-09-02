import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough, strFromU8, strToU8 } from 'fflate';
import { bytesToHex } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { BACKUP_SCHEMA_VERSION } from './backup-contract';
import type { BackupManifest } from './backup-contract';
import type { MusicTrack, PersonRelationship, PersonRelationshipNode } from '@still-alive/types';
import type { BackupSnapshot } from '../../infrastructure/database/database-models';
import { createAudioEmbed, extractAudioEmbeds, formatAudioDuration } from '../journal/embedded-media';
import { unlockPasswordVault } from '../vault/password-vault-crypto';
import { parsePasswordVaultBytes, passwordVaultExists, readPasswordVaultBytes, readPasswordVaultEnvelope, replacePasswordVaultEnvelope } from '../vault/password-vault-storage';
import { logPasswordVaultDiagnostic, passwordVaultErrorKind } from '../vault/password-vault-logging';
import { writePersistentError, writePersistentLog } from '../../infrastructure/platform/persistent-log';

const APP_VERSION = '0.1.0';
const MAX_BACKUP_ARCHIVE_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_BACKUP_EXPANDED_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_BACKUP_ENTRY_COUNT = 20_000;
const MAX_BACKUP_METADATA_BYTES = 16 * 1024 * 1024;
const MEDIA_PATH_SCHEMA_VERSION = 8;
const BACKUP_STREAM_CHUNK_BYTES = 256 * 1024;

export interface BackupArchive {
  uri: string;
  size: number;
}

export interface ParsedBackup {
  exportedAt: string;
  snapshot: BackupSnapshot;
  entries: Record<string, Uint8Array>;
  mediaFiles: Record<string, string>;
  vaultEnvelope: Uint8Array | null;
  temporaryDirectory: string;
}

export interface MaterializedBackup {
  snapshot: BackupSnapshot;
  createdFiles: string[];
  createdDirectories: string[];
}

interface MaterializeBackupOptions {
  snapshot?: BackupSnapshot;
  retainedMedia?: BackupSnapshot['media'];
}

export async function createBackupArchive(snapshot: BackupSnapshot): Promise<BackupArchive> {
  writePersistentLog('INFO', 'backup.export.started', { posts: snapshot.posts.length, people: snapshot.people.length, media: snapshot.media.length, books: snapshot.books?.length ?? 0, musicTracks: snapshot.musicTracks?.length ?? 0 });
  const portableMedia: BackupSnapshot['media'] = [];
  const mediaSources: Array<{ path: string; source: File }> = [];

  const albumByMedia = new Map((snapshot.albumMedia ?? []).map((relation) => [relation.mediaId, (snapshot.albums ?? []).find((album) => album.id === relation.albumId)]));
  for (const item of snapshot.media) {
    const source = new File(item.localPath);
    if (!source.exists) throw new Error(`本地媒体缺失：${item.id}`);
    const album = albumByMedia.get(item.id);
    const path = album ? `${album.personId ? `people/${album.personId}` : 'self'}/albums/${album.id}/${item.id}${source.extension || '.bin'}` : `${item.kind === 'book' ? 'books' : item.kind === 'audio' ? 'music' : 'media'}/${item.id}${source.extension || '.bin'}`;
    mediaSources.push({ path, source });
    portableMedia.push({ ...item, localPath: path });
  }

  const portableSnapshot: BackupSnapshot = { ...snapshot, media: portableMedia };
  const entries: Record<string, Uint8Array> = { 'data.json': strToU8(JSON.stringify(portableSnapshot, null, 2)) };
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

  const files: BackupManifest['files'] = [];
  for (const [path, bytes] of Object.entries(entries)) files.push({ path, checksum: await checksum(bytes) });
  const exportedAt = new Date().toISOString();
  const output = new File(Paths.cache, `still-alive-${exportedAt.slice(0, 10)}.zip`);
  output.create({ overwrite: true });
  let outputHandle: ReturnType<File['open']> | null = output.open(FileMode.WriteOnly);
  let archiveSize = 0;
  try {
    const archive = new Zip((error, bytes) => {
      if (error) throw error;
      if (bytes) {
        outputHandle?.writeBytes(bytes);
        archiveSize += bytes.byteLength;
      }
    });
    for (const [path, bytes] of Object.entries(entries)) addBufferedZipEntry(archive, path, bytes, path !== 'vault.enc');
    for (const { path, source } of mediaSources) files.push({ path, checksum: streamMediaZipEntry(archive, path, source) });
    const manifest: BackupManifest = { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, appVersion: APP_VERSION, files };
    addBufferedZipEntry(archive, 'manifest.json', strToU8(JSON.stringify(manifest, null, 2)), true);
    archive.end();
    writePersistentLog('INFO', 'backup.export.finished', { uri: output.uri, size: archiveSize, files: files.length });
    return { uri: output.uri, size: archiveSize };
  } catch (cause) {
    writePersistentError('backup.export.failed', cause, { posts: snapshot.posts.length, people: snapshot.people.length, media: snapshot.media.length });
    try { outputHandle?.close(); } catch { /* preserve the export failure */ }
    outputHandle = null;
    try { if (output.exists) output.delete(); } catch { /* preserve the export failure */ }
    throw cause;
  } finally {
    outputHandle?.close();
  }
}

function addBufferedZipEntry(archive: Zip, path: string, bytes: Uint8Array, compress: boolean): void {
  const entry = compress ? new ZipDeflate(path, { level: 6 }) : new ZipPassThrough(path);
  archive.add(entry);
  entry.push(bytes, true);
}

function streamMediaZipEntry(archive: Zip, path: string, source: File): string {
  const size = source.size;
  if (!Number.isSafeInteger(size) || size < 0) throw new Error(`本地媒体大小无效：${path}`);
  const entry = new ZipPassThrough(path);
  archive.add(entry);
  const sourceHandle = source.open(FileMode.ReadOnly);
  const digest = sha256.create();
  let offset = 0;
  try {
    if (size === 0) entry.push(new Uint8Array(0), true);
    while (offset < size) {
      const bytes = sourceHandle.readBytes(Math.min(BACKUP_STREAM_CHUNK_BYTES, size - offset));
      if (!bytes.byteLength) throw new Error(`读取本地媒体时提前结束：${path}`);
      offset += bytes.byteLength;
      digest.update(bytes);
      entry.push(bytes, offset === size);
    }
    return bytesToHex(digest.digest());
  } finally {
    digest.destroy();
    sourceHandle.close();
  }
}

export async function parseBackupArchive(uri: string): Promise<ParsedBackup> {
  writePersistentLog('INFO', 'backup.parse.started', { uri });
  logPasswordVaultDiagnostic('backup.parse.start');
  const archive = new File(uri);
  if (!archive.exists || !Number.isSafeInteger(archive.size) || archive.size <= 0 || archive.size > MAX_BACKUP_ARCHIVE_BYTES) throw new Error('备份文件过大或无效，无法安全读取');

  const temporaryDirectory = new Directory(Paths.cache, `still-alive-import-${Date.now()}`);
  temporaryDirectory.create({ intermediates: true });
  const storedFiles: Record<string, string> = {};
  const entryChecksums: Record<string, string> = {};
  const seenPaths = new Set<string>();
  const openHandles = new Set<ReturnType<File['open']>>();
  let entryCount = 0;
  let expandedBytes = 0;
  let storedFileIndex = 0;

  try {
    const archiveHandle = archive.open(FileMode.ReadOnly);
    try {
      const unzip = new Unzip((entry) => {
        entryCount += 1;
        if (entryCount > MAX_BACKUP_ENTRY_COUNT) throw new Error('备份包含过多文件，无法安全读取');
        if (!isSafeRelativePath(entry.name) || seenPaths.has(entry.name)) throw new Error(`备份文件路径无效：${entry.name}`);
        seenPaths.add(entry.name);

        const storedFile = new File(temporaryDirectory, `entry-${String(storedFileIndex++).padStart(6, '0')}.bin`);
        storedFile.create({ overwrite: true });
        const storedHandle = storedFile.open(FileMode.WriteOnly);
        openHandles.add(storedHandle);
        const digest = sha256.create();
        let closed = false;
        const closeStoredHandle = () => {
          if (!closed) {
            closed = true;
            openHandles.delete(storedHandle);
            storedHandle.close();
          }
        };
        entry.ondata = (error, bytes, final) => {
          try {
            if (error) throw error;
            if (bytes?.byteLength) {
              expandedBytes += bytes.byteLength;
              if (!Number.isSafeInteger(expandedBytes) || expandedBytes > MAX_BACKUP_EXPANDED_BYTES) throw new Error('备份解压后过大，无法安全读取');
              storedHandle.writeBytes(bytes);
              digest.update(bytes);
            }
            if (final) {
              closeStoredHandle();
              storedFiles[entry.name] = storedFile.uri;
              entryChecksums[entry.name] = bytesToHex(digest.digest());
              digest.destroy();
            }
          } catch (cause) {
            closeStoredHandle();
            digest.destroy();
            throw cause;
          }
        };
        try {
          entry.start();
        } catch (cause) {
          closeStoredHandle();
          digest.destroy();
          throw cause;
        }
      });
      unzip.register(UnzipInflate);

      let offset = 0;
      while (offset < archive.size) {
        const bytes = archiveHandle.readBytes(Math.min(BACKUP_STREAM_CHUNK_BYTES, archive.size - offset));
        if (!bytes.byteLength) throw new Error('读取备份时提前结束');
        offset += bytes.byteLength;
        unzip.push(bytes, offset === archive.size);
      }
    } finally {
      archiveHandle.close();
    }

    for (const handle of openHandles) handle.close();
    openHandles.clear();
    logPasswordVaultDiagnostic('backup.parse.unzipped', { archiveBytes: archive.size, entries: entryCount });

    const manifestBytes = await readStoredBackupEntry(storedFiles, 'manifest.json');
    const dataBytes = await readStoredBackupEntry(storedFiles, 'data.json');
    const manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest;
    if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1 || manifest.schemaVersion > BACKUP_SCHEMA_VERSION) throw new Error(`不支持的备份版本：${manifest.schemaVersion}`);
    if (!Array.isArray(manifest.files)) throw new Error('备份清单格式无效');

    const manifestPaths = new Set<string>();
    for (const item of manifest.files) {
      if (!item || typeof item.path !== 'string' || typeof item.checksum !== 'string' || !isSafeRelativePath(item.path) || manifestPaths.has(item.path)) throw new Error('备份清单格式无效');
      manifestPaths.add(item.path);
      if (!storedFiles[item.path]) throw new Error(`备份文件缺失：${item.path}`);
      if (entryChecksums[item.path] !== item.checksum) throw new Error(`备份文件校验失败：${item.path}`);
    }

    const snapshot = JSON.parse(strFromU8(dataBytes)) as BackupSnapshot;
    migrateSnapshot(snapshot);
    validateSnapshot(snapshot, manifest.schemaVersion < MEDIA_PATH_SCHEMA_VERSION);
    const entries: Record<string, Uint8Array> = { 'manifest.json': manifestBytes, 'data.json': dataBytes };
    const vaultEnvelope = storedFiles['vault.enc'] ? await readStoredBackupEntry(storedFiles, 'vault.enc') : null;
    if (vaultEnvelope) {
      if (!manifestPaths.has('vault.enc')) throw new Error('备份中的密码本未列入清单');
      parsePasswordVaultBytes(vaultEnvelope);
      entries['vault.enc'] = vaultEnvelope;
    }
    const mediaFiles: Record<string, string> = {};
    for (const item of snapshot.media) {
      const path = item.localPath;
      if (!storedFiles[path]) throw new Error(`备份媒体缺失：${path}`);
      mediaFiles[path] = storedFiles[path];
    }
    writePersistentLog('INFO', 'backup.parse.finished', { uri, archiveBytes: archive.size, entries: entryCount, media: snapshot.media.length, posts: snapshot.posts.length, people: snapshot.people.length, hasVault: Boolean(vaultEnvelope) });
    return { exportedAt: manifest.exportedAt, snapshot, entries, mediaFiles, vaultEnvelope, temporaryDirectory: temporaryDirectory.uri };
  } catch (cause) {
    writePersistentError('backup.parse.failed', cause, { uri, archiveBytes: archive.size, entries: entryCount, expandedBytes });
    for (const handle of openHandles) {
      try { handle.close(); } catch { /* preserve the parse failure */ }
    }
    try { if (temporaryDirectory.exists) temporaryDirectory.delete(); } catch { /* preserve the parse failure */ }
    throw cause;
  }
}

async function readStoredBackupEntry(storedFiles: Record<string, string>, path: string): Promise<Uint8Array> {
  const uri = storedFiles[path];
  if (!uri) throw new Error(`备份缺少 ${path}`);
  const file = new File(uri);
  if (!Number.isSafeInteger(file.size) || file.size > MAX_BACKUP_METADATA_BYTES) throw new Error(`备份中的 ${path} 过大，无法安全读取`);
  return file.bytes();
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
    writePersistentError('backup.restore-vault.failed', cause, { hasCurrentVault: passwordVaultExists() });
    logPasswordVaultDiagnostic('backup.restore-vault.failed', { error: passwordVaultErrorKind(cause) });
    throw cause;
  } finally {
    backupSession.dek.fill(0);
  }
}

export function mergeBackupSnapshots(current: BackupSnapshot, incoming: BackupSnapshot): BackupSnapshot {
  const media = mergeMedia(current.media, incoming.media);
  const mediaIds = new Set(media.map((item) => item.id));
  const tagGroups = mergeUpdatedEntities(current.tagGroups ?? [], incoming.tagGroups ?? [], (item) => item.name.toLocaleLowerCase());
  const incomingTags = (incoming.tagDefinitions ?? []).map((tag) => {
    const groupId = tag.groupId ? tagGroups.incomingIds.get(tag.groupId) ?? tag.groupId : null;
    const normalizedName = tag.groupId && groupId !== tag.groupId && tag.normalizedName.startsWith(`${tag.groupId}:`)
      ? `${groupId}:${tag.normalizedName.slice(tag.groupId.length + 1)}`
      : tag.normalizedName;
    return { ...tag, groupId, normalizedName };
  });
  const tagDefinitions = mergeUpdatedEntities(current.tagDefinitions ?? [], incomingTags, (item) => item.normalizedName);
  const people = mergeUpdatedById(current.people, incoming.people);
  const relationshipNodes = mergeUpdatedEntities(
    current.personRelationshipNodes ?? [],
    incoming.personRelationshipNodes ?? [],
    (item) => item.kind === 'self' ? 'self' : item.personId ? `person:${item.personId}` : `placeholder:${item.id}`,
  );
  const posts = mergeUpdatedById(current.posts, incoming.posts);
  const albums = mergeUpdatedById(current.albums ?? [], incoming.albums ?? []);
  const musicTracks = mergeUpdatedEntities(current.musicTracks ?? [], incoming.musicTracks ?? [], (item) => item.mediaId);
  const musicPlaylists = mergeUpdatedById(current.musicPlaylists ?? [], incoming.musicPlaylists ?? []);
  const books = mergeUpdatedEntities(current.books ?? [], incoming.books ?? [], (item) => item.fileMediaId);
  const bookLists = mergeUpdatedById(current.bookLists ?? [], incoming.bookLists ?? []);
  const incomingBookExcerpts = (incoming.bookExcerpts ?? []).map((item) => ({ ...item, bookId: books.incomingIds.get(item.bookId) ?? item.bookId }));
  const bookExcerpts = mergePreferCurrentById(current.bookExcerpts ?? [], incomingBookExcerpts);
  const personIds = new Set(people.map((item) => item.id));
  const postIds = new Set(posts.map((item) => item.id));
  const albumIds = new Set(albums.map((item) => item.id));
  const trackIds = new Set(musicTracks.items.map((item) => item.id));
  const playlistIds = new Set(musicPlaylists.map((item) => item.id));
  const bookIds = new Set(books.items.map((item) => item.id));
  const bookListIds = new Set(bookLists.map((item) => item.id));
  const excerptIds = new Set(bookExcerpts.map((item) => item.id));
  const customTagIds = new Set(tagDefinitions.items.map((item) => item.id));
  const validRelationshipNodes = relationshipNodes.items.filter((item) => item.kind !== 'person' || Boolean(item.personId && personIds.has(item.personId)));
  const relationshipNodeIds = new Set(validRelationshipNodes.map((item) => item.id));
  const incomingRelationships = (incoming.personRelationships ?? []).map((item) => ({
    ...item,
    sourceNodeId: relationshipNodes.incomingIds.get(item.sourceNodeId) ?? item.sourceNodeId,
    targetNodeId: relationshipNodes.incomingIds.get(item.targetNodeId) ?? item.targetNodeId,
  }));

  const albumMedia = mergeAlbumMedia(
    current.albumMedia ?? [],
    (incoming.albumMedia ?? []).filter((item) => albumIds.has(item.albumId) && mediaIds.has(item.mediaId)),
  );
  const albumByMedia = new Map(albumMedia.map((item) => [item.mediaId, item.albumId]));

  return {
    checkIns: mergeCheckIns(current.checkIns, incoming.checkIns),
    posts,
    drafts: mergeUpdatedByKey(current.drafts, incoming.drafts, (item) => item.dayKey),
    people,
    media,
    postPersons: mergeRelations(
      current.postPersons,
      incoming.postPersons.filter((item) => postIds.has(item.postId) && personIds.has(item.personId)),
      (item) => `${item.postId}:${item.personId}`,
    ),
    settings: { ...incoming.settings, ...current.settings },
    tagDefinitions: tagDefinitions.items,
    tagGroups: tagGroups.items,
    tagSystemSettings: mergePreferCurrentByKey(current.tagSystemSettings ?? [], incoming.tagSystemSettings ?? [], (item) => item.system),
    personTags: mergeRelations(
      current.personTags ?? [],
      (incoming.personTags ?? []).map((item) => item.kind === 'custom' ? { ...item, value: tagDefinitions.incomingIds.get(item.value) ?? item.value } : item)
        .filter((item) => personIds.has(item.personId) && (item.kind !== 'custom' || customTagIds.has(item.value))),
      (item) => `${item.personId}:${item.kind}:${item.value}`,
    ),
    personRelationshipNodes: validRelationshipNodes,
    personRelationships: mergeRelations(
      current.personRelationships ?? [],
      incomingRelationships.filter((item) => relationshipNodeIds.has(item.sourceNodeId) && relationshipNodeIds.has(item.targetNodeId)),
      (item) => [item.sourceNodeId, item.targetNodeId].sort().join(':'),
    ),
    albums: albums.map((album) => album.coverMediaId && albumByMedia.get(album.coverMediaId) !== album.id ? { ...album, coverMediaId: null } : album),
    albumMedia,
    personBooks: mergeRelations(
      current.personBooks ?? [],
      (incoming.personBooks ?? []).map((item) => ({ ...item, bookId: books.incomingIds.get(item.bookId) ?? item.bookId }))
        .filter((item) => personIds.has(item.personId) && bookIds.has(item.bookId)),
      (item) => `${item.personId}:${item.bookId}`,
    ),
    musicTracks: musicTracks.items,
    musicCollectionEntries: mergeRelations(
      current.musicCollectionEntries ?? [],
      (incoming.musicCollectionEntries ?? []).map((item) => ({ ...item, trackId: musicTracks.incomingIds.get(item.trackId) ?? item.trackId }))
        .filter((item) => trackIds.has(item.trackId) && (item.targetType === 'self' || Boolean(item.targetId && personIds.has(item.targetId)))),
      (item) => `${item.trackId}:${item.targetType}:${item.targetId ?? ''}`,
    ),
    musicPlaylists,
    musicPlaylistEntries: mergeRelations(
      current.musicPlaylistEntries ?? [],
      (incoming.musicPlaylistEntries ?? []).map((item) => ({ ...item, trackId: musicTracks.incomingIds.get(item.trackId) ?? item.trackId }))
        .filter((item) => playlistIds.has(item.playlistId) && trackIds.has(item.trackId)),
      (item) => `${item.playlistId}:${item.trackId}`,
    ),
    bookLists,
    bookListEntries: mergeRelations(
      current.bookListEntries ?? [],
      (incoming.bookListEntries ?? []).map((item) => ({ ...item, bookId: books.incomingIds.get(item.bookId) ?? item.bookId }))
        .filter((item) => bookListIds.has(item.listId) && bookIds.has(item.bookId)),
      (item) => `${item.listId}:${item.bookId}`,
    ),
    books: books.items,
    bookExcerpts,
    readingNoteSources: mergeReadingNoteSources(current.readingNoteSources ?? [], incoming.readingNoteSources ?? [], books.incomingIds, postIds, bookIds, excerptIds),
  };
}

export function materializeBackupMedia(parsed: ParsedBackup, options: MaterializeBackupOptions = {}): MaterializedBackup {
  const snapshot = options.snapshot ?? parsed.snapshot;
  const retainedMedia = options.retainedMedia ?? [];
  const retainedById = new Map(retainedMedia.map((item) => [item.id, item]));
  const directory = new Directory(Paths.document, `media-restored-${Date.now()}`);
  directory.create({ intermediates: true });
  const createdFiles: string[] = [];
  const createdDirectories = [directory.uri];
  try {
    const restoredMedia = snapshot.media.map((item) => {
      const path = item.localPath;
      const bytes = parsed.entries[path];
      const streamedFileUri = parsed.mediaFiles[path];
      const streamedFile = streamedFileUri ? new File(streamedFileUri) : null;
      const retained = retainedById.get(item.id);
      if (!bytes && retained?.localPath === path && retained.checksum === item.checksum) {
        const file = new File(path);
        if (!file.exists) throw new Error(`当前媒体文件缺失：${item.id}`);
        return item;
      }
      if (!bytes && (!streamedFile || !streamedFile.exists)) throw new Error(`备份媒体缺失：${path}`);
      const fileName = path.split('/').pop();
      if (!fileName) throw new Error(`备份媒体路径无效：${path}`);
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
        const matches = streamedFile ? filesEqual(destination, streamedFile) : bytes ? equalBytes(destination.bytesSync(), bytes) : false;
        if (!matches) throw new Error(`本机存在不同内容的同名媒体：${path}`);
      } else {
        destination.create();
        createdFiles.push(destination.uri);
        if (streamedFile) copyFileContents(streamedFile, destination);
        else if (bytes) destination.write(bytes);
      }
      return { ...item, localPath: destination.uri };
    });
    return { snapshot: { ...snapshot, media: restoredMedia }, createdFiles, createdDirectories };
  } catch (cause) {
    writePersistentError('backup.materialize-media.failed', cause, { media: snapshot.media.length, createdFiles: createdFiles.length });
    cleanupMaterializedFiles(createdFiles, createdDirectories);
    throw cause;
  }
}

export function removeMaterializedMedia(materialized: MaterializedBackup): void {
  cleanupMaterializedFiles(materialized.createdFiles, materialized.createdDirectories);
}

export function releaseParsedBackup(parsed: ParsedBackup): void {
  if (!parsed.temporaryDirectory) return;
  const directory = new Directory(parsed.temporaryDirectory);
  parsed.temporaryDirectory = '';
  try { if (directory.exists) directory.delete(); } catch { /* cache cleanup is best effort */ }
}

function copyFileContents(source: File, destination: File): void {
  const size = source.size;
  if (!Number.isSafeInteger(size) || size < 0) throw new Error(`本地媒体大小无效：${source.uri}`);
  const sourceHandle = source.open(FileMode.ReadOnly);
  const destinationHandle = destination.open(FileMode.WriteOnly);
  let offset = 0;
  try {
    while (offset < size) {
      const bytes = sourceHandle.readBytes(Math.min(BACKUP_STREAM_CHUNK_BYTES, size - offset));
      if (!bytes.byteLength) throw new Error(`复制本地媒体时提前结束：${source.uri}`);
      offset += bytes.byteLength;
      destinationHandle.writeBytes(bytes);
    }
  } finally {
    sourceHandle.close();
    destinationHandle.close();
  }
}

function filesEqual(left: File, right: File): boolean {
  if (left.size !== right.size) return false;
  const size = left.size;
  if (!Number.isSafeInteger(size) || size < 0) return false;
  const leftHandle = left.open(FileMode.ReadOnly);
  const rightHandle = right.open(FileMode.ReadOnly);
  let offset = 0;
  try {
    while (offset < size) {
      const leftBytes = leftHandle.readBytes(Math.min(BACKUP_STREAM_CHUNK_BYTES, size - offset));
      if (!leftBytes.byteLength) return false;
      const rightBytes = rightHandle.readBytes(leftBytes.byteLength);
      if (leftBytes.byteLength !== rightBytes.byteLength || !equalBytes(leftBytes, rightBytes)) return false;
      offset += leftBytes.byteLength;
    }
    return true;
  } finally {
    leftHandle.close();
    rightHandle.close();
  }
}

function validateSnapshot(value: BackupSnapshot, allowLegacyGenericMediaPath = false): void {
  if (!value || typeof value !== 'object') throw new Error('备份数据格式无效');
  const collections = ['checkIns', 'posts', 'drafts', 'people', 'media', 'postPersons', 'tagDefinitions', 'tagGroups', 'tagSystemSettings', 'personTags', 'personRelationshipNodes', 'personRelationships', 'albums', 'albumMedia', 'personBooks'] as const;
  for (const key of collections) if (!Array.isArray(value[key])) throw new Error(`备份数据缺少 ${key}`);

  assertUniqueIds(value.posts, '记录');
  assertUniqueIds(value.people, '人物');
  assertUniqueIds(value.media, '媒体');
  const tagDefinitions = value.tagDefinitions ?? [];
  const tagGroups = value.tagGroups ?? [];
  const tagSystemSettings = value.tagSystemSettings ?? [];
  const personTags = value.personTags ?? [];
  const personRelationshipNodes = value.personRelationshipNodes ?? [];
  const personRelationships = value.personRelationships ?? [];
  const albums = value.albums ?? [];
  const albumMedia = value.albumMedia ?? [];
  const personBooks = value.personBooks ?? [];
  const musicTracks = value.musicTracks ?? [];
  const musicCollectionEntries = value.musicCollectionEntries ?? [];
  const musicPlaylists = value.musicPlaylists ?? [];
  const musicPlaylistEntries = value.musicPlaylistEntries ?? [];
  const bookLists = value.bookLists ?? [];
  const bookListEntries = value.bookListEntries ?? [];
  const books = value.books ?? [];
  const bookExcerpts = value.bookExcerpts ?? [];
  const readingNoteSources = value.readingNoteSources ?? [];
  assertUniqueIds(tagDefinitions, '标签');
  assertUniqueIds(tagGroups, '标签组');
  assertUniqueIds(albums, '相册');
  assertUniqueIds(musicTracks, '音乐曲目');
  assertUniqueIds(musicPlaylists, '音乐歌单');
  assertUniqueIds(bookLists, '书单');
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
  const bookListIds = new Set(bookLists.map((list) => list.id));
  const personBookKeys = new Set<string>();
  for (const relation of personBooks) {
    const key = `${relation.personId}:${relation.bookId}`;
    if (!personIds.has(relation.personId) || !bookIds.has(relation.bookId) || personBookKeys.has(key)) throw new Error('备份中的人物喜欢的书籍关联无效');
    personBookKeys.add(key);
  }
  const excerptIds = new Set(bookExcerpts.map((excerpt) => excerpt.id));
  const musicTrackIds = new Set(musicTracks.map((track) => track.id));
  const musicPlaylistIds = new Set(musicPlaylists.map((playlist) => playlist.id));
  for (const track of musicTracks) {
    if (!mediaIds.has(track.mediaId) || !value.media.find((item) => item.id === track.mediaId)?.mimeType.startsWith('audio/')) throw new Error('备份中的音乐文件关联无效');
    if (track.coverMediaId && !mediaIds.has(track.coverMediaId)) throw new Error('备份中的音乐封面关联无效');
    if (!Number.isSafeInteger(track.playCount) || track.playCount < 0) throw new Error('备份中的音乐播放次数无效');
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
    if (!['pdf', 'epub', 'mobi', 'txt', 'html', 'fb2', 'azw', 'azw3'].includes(book.format) || !['ready', 'protected', 'unsupported', 'failed'].includes(book.parseStatus)) throw new Error('备份中的书籍格式或解析状态无效');
    if (!Number.isFinite(book.progress) || book.progress < 0 || book.progress > 1) throw new Error('备份中的阅读进度无效');
    if (book.lastReadAt !== null && (typeof book.lastReadAt !== 'string' || Number.isNaN(new Date(book.lastReadAt).getTime()))) throw new Error('备份中的最近阅读时间无效');
    if (book.locationType && !['epub-cfi', 'reflow-cfi', 'pdf-page', 'manual'].includes(book.locationType)) throw new Error('备份中的书籍定位类型无效');
    if (book.pageCount != null && (!Number.isInteger(book.pageCount) || book.pageCount < 1)) throw new Error('备份中的 PDF 页数无效');
    if (book.chapterCache && (!Array.isArray(book.chapterCache) || book.chapterCache.some((item) => !item || typeof item.href !== 'string' || typeof item.label !== 'string' || !Number.isInteger(item.depth)))) throw new Error('备份中的书籍目录无效');
  }
  for (const list of bookLists) {
    if (typeof list.name !== 'string' || !list.name.trim() || list.name.length > 40 || !isValidDate(list.createdAt) || !isValidDate(list.updatedAt)) throw new Error('备份中的书单无效');
  }
  const bookListEntryKeys = new Set<string>();
  for (const entry of bookListEntries) {
    const key = `${entry.listId}:${entry.bookId}`;
    if (!bookListIds.has(entry.listId) || !bookIds.has(entry.bookId) || !isValidDate(entry.addedAt) || bookListEntryKeys.has(key)) throw new Error('备份中的书单书籍关联无效');
    bookListEntryKeys.add(key);
  }
  for (const excerpt of bookExcerpts) if (!bookIds.has(excerpt.bookId) || !excerpt.text.trim() || excerpt.text.length > 20_000 || (excerpt.locationType && !['epub-cfi', 'reflow-cfi', 'pdf-page', 'manual'].includes(excerpt.locationType)) || (excerpt.sourceKind && !['selection', 'manual'].includes(excerpt.sourceKind))) throw new Error('备份中的摘抄无效');
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
    if (person.bio != null && (typeof person.bio !== 'string' || person.bio.length > 500)) throw new Error('备份中的人物简介无效');
    if (person.gender && !['female', 'male', 'other'].includes(person.gender)) throw new Error('备份中的人物性别无效');
    if (!Array.isArray(person.contacts) || person.contacts.some((contact) => !contact || typeof contact.id !== 'string' || typeof contact.type !== 'string' || typeof contact.value !== 'string')) throw new Error('备份中的人物联系方式无效');
    if (person.birthday && !['solar', 'lunar', 'both'].includes(person.birthday.reminderMode)) throw new Error('备份中的生日提醒方式无效');
    if (person.birthday && (typeof person.birthday.reminderEnabled !== 'boolean' || !validReminderTime(person.birthday.reminderHour, person.birthday.reminderMinute))) throw new Error('备份中的生日提醒设置无效');
  }
  const relationshipIds = new Set<string>();
  const relationshipNodeIds = new Set<string>();
  const relationshipPersonIds = new Set<string>();
  let selfNodeCount = 0;
  for (const node of personRelationshipNodes) {
    if (!node.id || relationshipNodeIds.has(node.id) || !['self', 'person', 'placeholder'].includes(node.kind) || (node.label !== null && (typeof node.label !== 'string' || node.label.length > 40)) || !isValidDate(node.createdAt) || !isValidDate(node.updatedAt)) throw new Error('备份中的关系节点无效');
    if (node.kind === 'self') {
      if (node.id !== 'self' || node.personId !== null) throw new Error('备份中的关系树根节点无效');
      selfNodeCount += 1;
    } else if (node.kind === 'person') {
      if (!node.personId || !personIds.has(node.personId) || relationshipPersonIds.has(node.personId)) throw new Error('备份中的关系节点人物绑定无效');
      relationshipPersonIds.add(node.personId);
    } else if (node.personId !== null) throw new Error('备份中的未绑定关系节点无效');
    relationshipNodeIds.add(node.id);
  }
  if (selfNodeCount !== 1) throw new Error('备份中的关系树根节点无效');
  const relationshipPairs = new Set<string>();
  for (const relationship of personRelationships) {
    const pair = [relationship.sourceNodeId, relationship.targetNodeId].sort().join(':');
    if (!relationship.id || relationshipIds.has(relationship.id) || !relationshipNodeIds.has(relationship.sourceNodeId) || !relationshipNodeIds.has(relationship.targetNodeId) || relationship.sourceNodeId === relationship.targetNodeId || !['parent', 'child', 'partner', 'sibling', 'other'].includes(relationship.kind) || relationshipPairs.has(pair) || !isValidDate(relationship.createdAt) || !isValidDate(relationship.updatedAt)) throw new Error('备份中的人物关系无效');
    relationshipIds.add(relationship.id);
    relationshipPairs.add(pair);
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
    if (!albumIds.has(relation.albumId) || !mediaIds.has(relation.mediaId) || albumRelationByMedia.has(relation.mediaId)) throw new Error('备份中的相册媒体关联无效');
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
    const expectedPrefixes = album
      ? [`${album.personId ? `people/${album.personId}` : 'self'}/albums/${album.id}/`]
      : [`${item.kind === 'book' ? 'books' : item.kind === 'audio' ? 'music' : 'media'}/`, ...(allowLegacyGenericMediaPath ? ['media/'] : [])];
    const expectedPrefix = expectedPrefixes.find((prefix) => item.localPath.startsWith(prefix));
    const fileName = expectedPrefix ? item.localPath.slice(expectedPrefix.length) : '';
    if (!expectedPrefix || !fileName.startsWith(`${item.id}.`) || fileName.length <= item.id.length + 1 || fileName.includes('/')) throw new Error('备份中的媒体路径与相册关联不一致');
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
  const legacyRelationships = (value.personRelationships ?? []) as Array<PersonRelationship & { sourcePersonId?: string | null; targetPersonId?: string }>;
  const legacyFormat = legacyRelationships.some((item) => typeof item.targetPersonId === 'string');
  if (legacyFormat) {
    const nodesById = new Map<string, PersonRelationshipNode>();
    const timestamps = legacyRelationships.map((item) => item.createdAt).filter(isValidDate).sort();
    const fallbackTime = timestamps[0] ?? new Date(0).toISOString();
    nodesById.set('self', { id: 'self', kind: 'self', personId: null, label: null, createdAt: fallbackTime, updatedAt: fallbackTime });
    for (const relationship of legacyRelationships) {
      for (const personId of [relationship.sourcePersonId, relationship.targetPersonId]) {
        if (!personId) continue;
        const id = `person_node_${personId}`;
        if (!nodesById.has(id)) nodesById.set(id, { id, kind: 'person', personId, label: null, createdAt: relationship.createdAt, updatedAt: relationship.updatedAt });
      }
    }
    value.personRelationshipNodes = [...nodesById.values()];
    value.personRelationships = legacyRelationships.map((relationship) => ({
      id: relationship.id,
      sourceNodeId: relationship.sourcePersonId ? `person_node_${relationship.sourcePersonId}` : 'self',
      targetNodeId: `person_node_${relationship.targetPersonId}`,
      kind: relationship.kind,
      createdAt: relationship.createdAt,
      updatedAt: relationship.updatedAt,
    }));
  }
  value.personRelationshipNodes ??= [{ id: 'self', kind: 'self', personId: null, label: null, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() }];
  value.personRelationships ??= [];
  value.albums ??= [];
  value.albumMedia ??= [];
  value.personBooks ??= [];
  value.musicTracks ??= [];
  value.musicCollectionEntries ??= [];
  value.musicPlaylists ??= [];
  value.musicPlaylistEntries ??= [];
  value.bookLists ??= [];
  value.bookListEntries ??= [];
  for (const track of value.musicTracks) {
    track.coverMediaId ??= null;
    track.playCount ??= 0;
  }
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
    book.locationType ??= book.format === 'pdf' ? 'pdf-page' : book.location?.startsWith('epubcfi(') ? 'epub-cfi' : book.location?.startsWith('reflow:') || book.location?.startsWith('reflow-href:') ? 'reflow-cfi' : null;
    book.chapterHref ??= null;
    book.chapterTitle ??= null;
    book.engineVersion ??= null;
    book.pageCount ??= null;
    book.chapterCache ??= [];
    book.lastReadAt ??= book.progress > 0 ? book.updatedAt : null;
  }
  for (const excerpt of value.bookExcerpts) {
    if (excerpt.location?.match(/^page:\d+$/)) excerpt.location = excerpt.location.replace(/^page:/, 'pdf:');
    excerpt.locationType ??= excerpt.location?.startsWith('pdf:') ? 'pdf-page' : excerpt.location?.startsWith('epubcfi(') ? 'epub-cfi' : excerpt.location?.startsWith('reflow:') || excerpt.location?.startsWith('reflow-href:') ? 'reflow-cfi' : 'manual';
    excerpt.chapterTitle ??= null;
    excerpt.contextBefore ??= null;
    excerpt.contextAfter ??= null;
    excerpt.sourceKind ??= 'manual';
  }
  for (const media of value.media ?? []) {
    media.kind ??= media.mimeType.startsWith('audio/') ? 'audio' : media.mimeType.startsWith('video/') ? 'video' : 'image';
    media.originalName ??= null;
    media.sizeBytes ??= null;
  }
  if (Array.isArray(value.people)) for (const person of value.people) {
    person.gender ??= null;
    person.birthday ??= null;
    person.contacts ??= [];
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

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
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

function mergeMedia(current: BackupSnapshot['media'], incoming: BackupSnapshot['media']): BackupSnapshot['media'] {
  const items = [...current];
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (existing) {
      if (existing.checksum !== item.checksum) throw new Error(`媒体 ${item.id} 在当前数据与备份中的内容不一致，无法安全合并`);
      continue;
    }
    items.push(item);
    byId.set(item.id, item);
  }
  return items;
}

function mergeCheckIns(current: BackupSnapshot['checkIns'], incoming: BackupSnapshot['checkIns']): BackupSnapshot['checkIns'] {
  const items = [...current];
  const ids = new Set(current.map((item) => item.id));
  const days = new Set(current.map((item) => item.dayKey));
  for (const item of incoming) {
    if (ids.has(item.id) || days.has(item.dayKey)) continue;
    items.push(item);
    ids.add(item.id);
    days.add(item.dayKey);
  }
  return items;
}

function mergeUpdatedById<T extends { id: string; updatedAt: string }>(current: T[], incoming: T[]): T[] {
  return mergeUpdatedByKey(current, incoming, (item) => item.id);
}

function mergeUpdatedByKey<T extends { updatedAt: string }>(current: T[], incoming: T[], keyOf: (item: T) => string): T[] {
  const items = [...current];
  const indexes = new Map(items.map((item, index) => [keyOf(item), index]));
  for (const item of incoming) {
    const key = keyOf(item);
    const index = indexes.get(key);
    if (index === undefined) {
      indexes.set(key, items.length);
      items.push(item);
    } else if (item.updatedAt > items[index].updatedAt) {
      items[index] = item;
    }
  }
  return items;
}

function mergeUpdatedEntities<T extends { id: string; updatedAt: string }>(current: T[], incoming: T[], naturalKeyOf: (item: T) => string): { items: T[]; incomingIds: Map<string, string> } {
  const items = [...current];
  const indexesById = new Map(items.map((item, index) => [item.id, index]));
  const indexesByNaturalKey = new Map(items.map((item, index) => [naturalKeyOf(item), index]));
  const incomingIds = new Map<string, string>();
  for (const item of incoming) {
    const idIndex = indexesById.get(item.id);
    const naturalIndex = indexesByNaturalKey.get(naturalKeyOf(item));
    const index = idIndex ?? naturalIndex;
    if (index === undefined) {
      indexesById.set(item.id, items.length);
      indexesByNaturalKey.set(naturalKeyOf(item), items.length);
      incomingIds.set(item.id, item.id);
      items.push(item);
      continue;
    }
    const existing = items[index];
    incomingIds.set(item.id, existing.id);
    if (item.updatedAt <= existing.updatedAt) continue;
    const next = { ...item, id: existing.id };
    const conflictingIndex = indexesByNaturalKey.get(naturalKeyOf(next));
    if (conflictingIndex !== undefined && conflictingIndex !== index) continue;
    indexesByNaturalKey.delete(naturalKeyOf(existing));
    indexesByNaturalKey.set(naturalKeyOf(next), index);
    items[index] = next;
  }
  return { items, incomingIds };
}

function mergePreferCurrentById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  return mergePreferCurrentByKey(current, incoming, (item) => item.id);
}

function mergePreferCurrentByKey<T>(current: T[], incoming: T[], keyOf: (item: T) => string): T[] {
  const items = [...current];
  const keys = new Set(current.map(keyOf));
  for (const item of incoming) {
    const key = keyOf(item);
    if (keys.has(key)) continue;
    keys.add(key);
    items.push(item);
  }
  return items;
}

function mergeRelations<T>(current: T[], incoming: T[], keyOf: (item: T) => string): T[] {
  return mergePreferCurrentByKey(current, incoming, keyOf);
}

function mergeAlbumMedia(current: NonNullable<BackupSnapshot['albumMedia']>, incoming: NonNullable<BackupSnapshot['albumMedia']>): NonNullable<BackupSnapshot['albumMedia']> {
  const items = [...current];
  const mediaIds = new Set(current.map((item) => item.mediaId));
  for (const item of incoming) {
    if (mediaIds.has(item.mediaId)) continue;
    mediaIds.add(item.mediaId);
    items.push(item);
  }
  return items;
}

function mergeReadingNoteSources(
  current: NonNullable<BackupSnapshot['readingNoteSources']>,
  incoming: NonNullable<BackupSnapshot['readingNoteSources']>,
  incomingBookIds: Map<string, string>,
  postIds: Set<string>,
  bookIds: Set<string>,
  excerptIds: Set<string>,
): NonNullable<BackupSnapshot['readingNoteSources']> {
  const items = current.map((item) => ({ ...item, excerptIds: [...item.excerptIds], quoteSnapshots: [...item.quoteSnapshots] }));
  const indexes = new Map(items.map((item, index) => [item.postId, index]));
  for (const source of incoming) {
    if (!postIds.has(source.postId)) continue;
    const bookId = source.bookId ? incomingBookIds.get(source.bookId) ?? source.bookId : null;
    if (bookId && !bookIds.has(bookId)) continue;
    const next = { ...source, bookId, excerptIds: source.excerptIds.filter((id) => excerptIds.has(id)) };
    const index = indexes.get(source.postId);
    if (index === undefined) {
      indexes.set(source.postId, items.length);
      items.push(next);
      continue;
    }
    const existing = items[index];
    const quoteKeys = new Set(existing.quoteSnapshots.map((item) => JSON.stringify(item)));
    items[index] = {
      ...existing,
      bookId: existing.bookId ?? next.bookId,
      excerptIds: [...new Set([...existing.excerptIds, ...next.excerptIds])],
      quoteSnapshots: [...existing.quoteSnapshots, ...next.quoteSnapshots.filter((item) => !quoteKeys.has(JSON.stringify(item)))],
    };
  }
  return items;
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
