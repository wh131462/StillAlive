import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { Media } from '@still-alive/types';
import { writePersistentError, writePersistentLog } from '../../infrastructure/platform/persistent-log';

const LAST_DOWNLOAD_DIRECTORY_KEY = 'music.last-download-directory';

export interface MusicDownloadResult {
  fileName: string;
}

export async function saveMusicCopy(media: Media, title: string): Promise<MusicDownloadResult | null> {
  writePersistentLog('INFO', 'music.download.started', { mediaId: media.id, title, localPath: media.localPath });
  const lastDirectoryUri = await SecureStore.getItemAsync(LAST_DOWNLOAD_DIRECTORY_KEY);
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync(lastDirectoryUri ?? undefined);
  } catch (cause) {
    if (isPickerCancellation(cause)) {
      writePersistentLog('INFO', 'music.download.pick.cancelled', { mediaId: media.id, title });
      return null;
    }
    writePersistentError('music.download.pick.failed', cause, { mediaId: media.id, title });
    throw cause;
  }

  const source = new File(media.localPath);
  if (!source.exists || source.size <= 0) throw new Error('歌曲文件不存在或无法读取');

  const fileName = availableFileName(directory, preferredFileName(media, title, source.extension));
  const stagingDirectory = new Directory(Paths.cache, `music-download-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  stagingDirectory.create();
  const stagedFile = new File(stagingDirectory, fileName);
  let destination: File | null = null;
  try {
    await source.copy(stagedFile);
    await stagedFile.copy(directory);
    destination = findFile(directory, fileName);
    if (!destination?.exists || destination.size <= 0) throw new Error('文件复制后无法读取');
    await SecureStore.setItemAsync(LAST_DOWNLOAD_DIRECTORY_KEY, directory.uri);
    const result = { fileName: destination.name || fileName };
    writePersistentLog('INFO', 'music.download.finished', { mediaId: media.id, title, fileName: result.fileName, directory: directory.uri });
    return result;
  } catch (cause) {
    writePersistentError('music.download.failed', cause, { mediaId: media.id, title, fileName, directory: directory.uri });
    try {
      const incompleteFile = destination ?? findFile(directory, fileName);
      if (incompleteFile?.exists) incompleteFile.delete();
    } catch {
      // 系统目录权限可能已被用户撤销，不覆盖原始错误。
    }
    throw cause;
  } finally {
    try {
      if (stagingDirectory.exists) stagingDirectory.delete();
    } catch {
      // 缓存目录可由系统后续回收。
    }
  }
}

function preferredFileName(media: Media, title: string, sourceExtension: string): string {
  const originalName = media.originalName?.split(/[\\/]/).pop()?.trim();
  const fallbackExtension = sourceExtension && sourceExtension.startsWith('.') ? sourceExtension : '';
  // Document providers can return URL-encoded names (for example `%E5...%20`).
  // Decode them before passing the name to expo-file-system. The new File API
  // treats a raw `%` in a child path as an invalid URI character on Android.
  const decodedOriginalName = originalName ? decodeFileName(originalName) : '';
  const decodedTitle = decodeFileName(title.trim());
  const requestedName = decodedOriginalName || `${decodedTitle || '未命名音乐'}${fallbackExtension}`;
  const sanitized = requestedName
    .replace(/[<>:"/\\|?*%#\u0000-\u001f]/g, '_')
    .replace(/[.\s]+$/g, '')
    .trim();
  return sanitized || `未命名音乐${fallbackExtension}`;
}

function decodeFileName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // Keep malformed provider output usable; sanitization below removes the
    // remaining URI-reserved characters.
    return value;
  }
}

function availableFileName(directory: Directory, requestedName: string): string {
  const existing = new Set(directory.list().map((entry) => entry.name.toLocaleLowerCase()));
  if (!existing.has(requestedName.toLocaleLowerCase())) return requestedName;

  const extensionIndex = requestedName.lastIndexOf('.');
  const hasExtension = extensionIndex > 0;
  const stem = hasExtension ? requestedName.slice(0, extensionIndex) : requestedName;
  const extension = hasExtension ? requestedName.slice(extensionIndex) : '';
  let index = 1;
  while (existing.has(`${stem} (${index})${extension}`.toLocaleLowerCase())) index += 1;
  return `${stem} (${index})${extension}`;
}

function findFile(directory: Directory, fileName: string): File | null {
  return directory.list().find((entry): entry is File => entry instanceof File && entry.name.toLocaleLowerCase() === fileName.toLocaleLowerCase()) ?? null;
}

function isPickerCancellation(cause: unknown): boolean {
  return cause instanceof Error && cause.message.toLocaleLowerCase().includes('cancel');
}
