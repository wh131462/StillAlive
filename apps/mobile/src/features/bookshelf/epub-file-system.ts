import { useCallback, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

// The published Expo adapter still imports removed root-level APIs in Expo 57.
// Keep this bridge local until the upstream adapter targets expo-file-system/legacy.
export function useEpubFileSystem() {
  const [file, setFile] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [size, setSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const downloadFile = useCallback(async (fromUrl: string, toFile: string) => {
    if (!FileSystem.documentDirectory) return { uri: null, mimeType: null };
    setDownloading(true);
    try {
      const task = FileSystem.createDownloadResumable(
        fromUrl,
        `${FileSystem.documentDirectory}${toFile}`,
        { cache: true },
        (value) => setProgress(value.totalBytesExpectedToWrite > 0 ? Math.round((value.totalBytesWritten / value.totalBytesExpectedToWrite) * 100) : 0),
      );
      const result = await task.downloadAsync();
      if (!result) throw new Error('书籍下载失败');
      const contentLength = Number(result.headers['Content-Length'] ?? 0);
      setFile(result.uri);
      setSize(Number.isFinite(contentLength) ? contentLength : 0);
      setSuccess(true);
      setError(null);
      return { uri: result.uri, mimeType: result.headers['Content-Type'] ?? null };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '书籍下载失败');
      setSuccess(false);
      return { uri: null, mimeType: null };
    } finally {
      setDownloading(false);
    }
  }, []);

  const getFileInfo = useCallback(async (fileUri: string) => {
    const info = await FileSystem.getInfoAsync(fileUri);
    return { uri: info.uri, exists: info.exists, isDirectory: info.exists ? info.isDirectory : false, size: info.exists ? info.size : undefined };
  }, []);

  return {
    file,
    progress,
    downloading,
    size,
    error,
    success,
    documentDirectory: FileSystem.documentDirectory,
    cacheDirectory: FileSystem.cacheDirectory,
    bundleDirectory: FileSystem.bundleDirectory ?? undefined,
    readAsStringAsync: FileSystem.readAsStringAsync,
    writeAsStringAsync: FileSystem.writeAsStringAsync,
    deleteAsync: (fileUri: string) => FileSystem.deleteAsync(fileUri, { idempotent: true }),
    downloadFile,
    getFileInfo,
  };
}
