import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { Media } from '@still-alive/types';

const LAST_DOWNLOAD_DIRECTORY_KEY = 'music.last-download-directory';

export interface MusicDownloadResult {
  fileName: string;
}

export type OpenMusicDownloadDirectoryResult = 'opened' | 'missing' | 'cancelled';

export async function saveMusicCopy(media: Media, title: string): Promise<MusicDownloadResult | null> {
  const lastDirectoryUri = await SecureStore.getItemAsync(LAST_DOWNLOAD_DIRECTORY_KEY);
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync(lastDirectoryUri ?? undefined);
  } catch (cause) {
    if (isPickerCancellation(cause)) return null;
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
    return { fileName: destination.name || fileName };
  } catch (cause) {
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

export async function openLastMusicDownloadDirectory(): Promise<OpenMusicDownloadDirectoryResult> {
  const directoryUri = await SecureStore.getItemAsync(LAST_DOWNLOAD_DIRECTORY_KEY);
  if (!directoryUri) return 'missing';
  try {
    await Directory.pickDirectoryAsync(directoryUri);
    return 'opened';
  } catch (cause) {
    if (isPickerCancellation(cause)) return 'cancelled';
    throw cause;
  }
}

function preferredFileName(media: Media, title: string, sourceExtension: string): string {
  const originalName = media.originalName?.split(/[\\/]/).pop()?.trim();
  const fallbackExtension = sourceExtension && sourceExtension.startsWith('.') ? sourceExtension : '';
  const requestedName = originalName || `${title.trim() || '未命名音乐'}${fallbackExtension}`;
  const sanitized = requestedName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[.\s]+$/g, '')
    .trim();
  return sanitized || `未命名音乐${fallbackExtension}`;
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
