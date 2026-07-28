import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { Media } from '@still-alive/types';

export async function persistPickedImage(asset: ImagePickerAsset): Promise<Media> {
  const id = createLocalId('media');
  const extension = fileExtension(asset);
  const documentDirectory = LegacyFileSystem.documentDirectory;
  if (!documentDirectory) throw new Error('应用数据目录不可用');
  const directoryUri = `${documentDirectory}media`;
  const destinationUri = `${directoryUri}/${id}${extension}`;

  try {
    await LegacyFileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
    await LegacyFileSystem.copyAsync({ from: asset.uri, to: destinationUri });
    const info = await LegacyFileSystem.getInfoAsync(destinationUri, { md5: true });
    if (!info.exists || info.isDirectory || info.size <= 0) throw new Error('照片文件为空');
    return {
      id,
      localPath: destinationUri,
      mimeType: asset.mimeType ?? mimeTypeForExtension(extension),
      width: asset.width || null,
      height: asset.height || null,
      checksum: info.md5 ?? '',
      createdAt: new Date().toISOString(),
    };
  } catch (cause) {
    await LegacyFileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(() => undefined);
    throw cause;
  }
}

export async function persistVoiceRecording(uri: string): Promise<Media> {
  const id = createLocalId('media');
  const directory = new Directory(Paths.document, 'media');
  directory.create({ idempotent: true, intermediates: true });
  const source = new File(uri);
  const extension = source.extension || '.m4a';
  const destination = new File(directory, `${id}${extension}`);
  try {
    await source.move(destination);
    if (!destination.exists || destination.size <= 0) throw new Error('录音文件为空');
    return {
      id,
      localPath: destination.uri,
      mimeType: mimeTypeForAudioExtension(extension),
      width: null,
      height: null,
      checksum: destination.md5 ?? '',
      createdAt: new Date().toISOString(),
    };
  } catch (cause) {
    if (destination.exists) destination.delete();
    throw cause;
  }
}

export async function persistAlbumImage(personId: string | null, albumId: string, asset: ImagePickerAsset): Promise<Media> {
  const id = createLocalId('media');
  const targetDirectory = personId
    ? new Directory(Paths.document, 'people', personId, 'albums', albumId)
    : new Directory(Paths.document, 'self', 'albums', albumId);
  targetDirectory.create({ idempotent: true, intermediates: true });
  const temporaryDirectory = new Directory(Paths.cache, 'album-imports');
  temporaryDirectory.create({ idempotent: true, intermediates: true });
  const extension = fileExtension(asset);
  const temporary = new File(temporaryDirectory, `${id}${extension}`);
  const destination = new File(targetDirectory, `${id}${extension}`);
  try {
    await new File(asset.uri).copy(temporary);
    if (!temporary.exists || temporary.size <= 0) throw new Error('照片文件为空');
    await temporary.move(destination);
    return {
      id,
      localPath: destination.uri,
      mimeType: asset.mimeType ?? mimeTypeForExtension(extension),
      width: asset.width || null,
      height: asset.height || null,
      checksum: destination.md5 ?? '',
      createdAt: new Date().toISOString(),
    };
  } catch (cause) {
    if (temporary.exists) temporary.delete();
    if (destination.exists) destination.delete();
    throw cause;
  }
}

export function deletePersonAlbumDirectory(personId: string | null, albumId?: string): void {
  const directory = personId
    ? albumId ? new Directory(Paths.document, 'people', personId, 'albums', albumId) : new Directory(Paths.document, 'people', personId)
    : albumId ? new Directory(Paths.document, 'self', 'albums', albumId) : new Directory(Paths.document, 'self');
  if (directory.exists) directory.delete();
}

export function cleanupOrphanedAlbumFiles(media: Media[]): void {
  const referencedPaths = new Set(media.map((item) => item.localPath));
  cleanupAlbumDirectories(new Directory(Paths.document, 'self', 'albums'), referencedPaths);
  const peopleDirectory = new Directory(Paths.document, 'people');
  if (!peopleDirectory.exists) return;
  for (const personEntry of peopleDirectory.list()) {
    if (!(personEntry instanceof Directory)) continue;
    cleanupAlbumDirectories(new Directory(personEntry, 'albums'), referencedPaths);
  }
}

function cleanupAlbumDirectories(albumsDirectory: Directory, referencedPaths: Set<string>): void {
  if (!albumsDirectory.exists) return;
  for (const albumEntry of albumsDirectory.list()) {
    if (!(albumEntry instanceof Directory)) continue;
    for (const file of albumEntry.list()) if (file instanceof File && !referencedPaths.has(file.uri)) file.delete();
    if (albumEntry.list().length === 0) albumEntry.delete();
  }
}

function fileExtension(asset: ImagePickerAsset): string {
  const match = asset.fileName?.match(/\.[a-zA-Z0-9]+$/);
  if (match) return match[0].toLowerCase();
  if (asset.mimeType === 'image/png') return '.png';
  if (asset.mimeType === 'image/webp') return '.webp';
  if (asset.mimeType === 'image/heic' || asset.mimeType === 'image/heif') return '.heic';
  return '.jpg';
}

function mimeTypeForExtension(extension: string): string {
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.heic' || extension === '.heif') return 'image/heic';
  return 'image/jpeg';
}

function mimeTypeForAudioExtension(extension: string): string {
  if (extension === '.webm') return 'audio/webm';
  if (extension === '.caf') return 'audio/x-caf';
  if (extension === '.3gp') return 'audio/3gpp';
  return 'audio/mp4';
}

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
