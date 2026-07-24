import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { BACKUP_SCHEMA_VERSION } from '@still-alive/backup';
import type { BackupManifest } from '@still-alive/backup';
import type { BackupSnapshot } from './sqlite-repository';

const APP_VERSION = '0.1.0';

export interface BackupArchive {
  uri: string;
  size: number;
}

export interface ParsedBackup {
  exportedAt: string;
  snapshot: BackupSnapshot;
  entries: Record<string, Uint8Array>;
}

export async function createBackupArchive(snapshot: BackupSnapshot): Promise<BackupArchive> {
  const entries: Record<string, Uint8Array> = {};
  const portableMedia = [];

  for (const item of snapshot.media) {
    const source = new File(item.localPath);
    if (!source.exists) throw new Error(`本地图片缺失：${item.id}`);
    const path = `media/${item.id}${source.extension || '.bin'}`;
    entries[path] = await source.bytes();
    portableMedia.push({ ...item, localPath: path });
  }

  const portableSnapshot: BackupSnapshot = { ...snapshot, media: portableMedia };
  entries['data.json'] = strToU8(JSON.stringify(portableSnapshot, null, 2));
  for (const post of snapshot.posts) {
    entries[`markdown/${post.dayKey}_${post.id}.md`] = strToU8(`# ${post.dayKey}\n\n${post.bodyMarkdown}\n`);
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
  const entries = unzipSync(await new File(uri).bytes());
  const manifestBytes = entries['manifest.json'];
  const dataBytes = entries['data.json'];
  if (!manifestBytes || !dataBytes) throw new Error('备份缺少 manifest.json 或 data.json');

  const manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest;
  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error(`不支持的备份版本：${manifest.schemaVersion}`);
  if (!Array.isArray(manifest.files)) throw new Error('备份清单格式无效');
  for (const item of manifest.files) {
    const bytes = entries[item.path];
    if (!bytes) throw new Error(`备份文件缺失：${item.path}`);
    if (await checksum(bytes) !== item.checksum) throw new Error(`备份文件校验失败：${item.path}`);
  }

  const snapshot = JSON.parse(strFromU8(dataBytes)) as BackupSnapshot;
  validateSnapshot(snapshot);
  return { exportedAt: manifest.exportedAt, snapshot, entries };
}

export function materializeBackupMedia(parsed: ParsedBackup): BackupSnapshot {
  const directory = new Directory(Paths.document, `media-restored-${Date.now()}`);
  directory.create({ intermediates: true });
  try {
    const restoredMedia = parsed.snapshot.media.map((item) => {
      const path = item.localPath;
      const bytes = parsed.entries[path];
      if (!bytes) throw new Error(`备份图片缺失：${path}`);
      const fileName = path.split('/').pop();
      if (!fileName) throw new Error(`备份图片路径无效：${path}`);
      const destination = new File(directory, fileName);
      destination.create();
      destination.write(bytes);
      return { ...item, localPath: destination.uri };
    });
    return { ...parsed.snapshot, media: restoredMedia };
  } catch (cause) {
    if (directory.exists) directory.delete();
    throw cause;
  }
}

export function removeMaterializedMedia(snapshot: BackupSnapshot): void {
  for (const item of snapshot.media) {
    const file = new File(item.localPath);
    if (file.exists) file.delete();
  }
}

function validateSnapshot(value: BackupSnapshot): void {
  if (!value || typeof value !== 'object') throw new Error('备份数据格式无效');
  const collections = ['checkIns', 'posts', 'drafts', 'people', 'media', 'postPersons'] as const;
  for (const key of collections) if (!Array.isArray(value[key])) throw new Error(`备份数据缺少 ${key}`);

  const postIds = new Set(value.posts.map((post) => post.id));
  const personIds = new Set(value.people.map((person) => person.id));
  for (const relation of value.postPersons) {
    if (!postIds.has(relation.postId) || !personIds.has(relation.personId)) throw new Error('备份中的人物关联无效');
  }
  for (const item of value.media) {
    if (!item.localPath.startsWith('media/') || item.localPath.includes('..')) throw new Error('备份中的媒体路径无效');
  }
  if (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) value.settings = {};
  for (const setting of Object.values(value.settings)) if (typeof setting !== 'string') throw new Error('备份中的设置数据无效');
}

async function checksum(bytes: Uint8Array): Promise<string> {
  const data = new Uint8Array(bytes.byteLength);
  data.set(bytes);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
