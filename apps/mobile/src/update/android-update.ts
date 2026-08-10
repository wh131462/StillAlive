import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { writePersistentError, writePersistentLog } from '../data/persistent-log';

export const ANDROID_UPDATE_MANIFEST_URL = 'https://github.com/wh131462/StillAlive/releases/latest/download/latest.json';

export interface AndroidUpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseNotes?: string;
}

export type AndroidUpdateCheckResult =
  | { status: 'unsupported' }
  | { status: 'not-configured' }
  | { status: 'current' }
  | { status: 'available'; manifest: AndroidUpdateManifest };

export interface AndroidUpdateDownloadProgress {
  bytesWritten: number;
  totalBytes: number | null;
}

export interface AndroidUpdateDownloadOptions {
  onProgress?(progress: AndroidUpdateDownloadProgress): void;
  signal?: AbortSignal;
}

export interface AndroidUpdateInstallResult {
  status: 'started' | 'permission-required';
  contentUri: string;
}

interface ApkInstallerModule {
  nativeVersion: string;
  nativeBuildVersion: number;
  installApkAsync(contentUri: string): Promise<'started' | 'permission-required'>;
}

const apkInstaller = Platform.OS === 'android'
  ? requireOptionalNativeModule<ApkInstallerModule>('StillAliveApkInstaller')
  : null;

export function getCurrentAndroidVersion() {
  return {
    versionName: apkInstaller?.nativeVersion || '0.1.0',
    versionCode: Number(apkInstaller?.nativeBuildVersion) || 1,
  };
}

export async function checkForAndroidUpdate(): Promise<AndroidUpdateCheckResult> {
  writePersistentLog('INFO', 'update.check.started', { platform: Platform.OS });
  if (Platform.OS !== 'android' || !apkInstaller) {
    writePersistentLog('INFO', 'update.check.finished', { status: 'unsupported' });
    return { status: 'unsupported' };
  }
  if (!ANDROID_UPDATE_MANIFEST_URL.trim()) {
    writePersistentLog('WARN', 'update.check.finished', { status: 'not-configured' });
    return { status: 'not-configured' };
  }

  assertHttpsUrl(ANDROID_UPDATE_MANIFEST_URL, '更新服务器地址');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(ANDROID_UPDATE_MANIFEST_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`更新服务器返回 ${response.status}`);
    const manifest = parseManifest(await response.json());
    const result: AndroidUpdateCheckResult = manifest.versionCode > getCurrentAndroidVersion().versionCode
      ? { status: 'available', manifest }
      : { status: 'current' };
    writePersistentLog('INFO', 'update.check.finished', { status: result.status, versionCode: manifest.versionCode, versionName: manifest.versionName });
    return result;
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      const timeoutError = new Error('检查更新超时');
      writePersistentError('update.check.failed', timeoutError);
      throw timeoutError;
    }
    writePersistentError('update.check.failed', cause);
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadAndInstallAndroidUpdate(
  manifest: AndroidUpdateManifest,
  options: AndroidUpdateDownloadOptions = {},
): Promise<AndroidUpdateInstallResult> {
  let incompleteDownload: { destination: string; marker: string } | null = null;
  let downloadCompleted = false;
  try {
    if (Platform.OS !== 'android' || !apkInstaller) throw new Error('当前环境不支持 APK 更新');
    writePersistentLog('INFO', 'update.install.started', { versionCode: manifest.versionCode, versionName: manifest.versionName });
    assertHttpsUrl(manifest.apkUrl, 'APK 下载地址');
    if (!FileSystem.cacheDirectory) throw new Error('无法访问应用缓存目录');

    const destination = `${FileSystem.cacheDirectory}still-alive-${manifest.versionCode}.apk`;
    const marker = `${destination}.complete.json`;
    if (options.signal?.aborted) throw cancelledError();
    const cachedContentUri = await getCachedUpdateContentUri(destination, marker, manifest);
    if (options.signal?.aborted) throw cancelledError();
    if (cachedContentUri) {
      writePersistentLog('INFO', 'update.download.cache-hit', { versionCode: manifest.versionCode, versionName: manifest.versionName });
      const installResult = await apkInstaller.installApkAsync(cachedContentUri);
      writePersistentLog('INFO', 'update.install.finished', { result: installResult, cached: true });
      return { status: installResult, contentUri: cachedContentUri };
    }

    await deleteUpdateFiles(destination, marker);
    incompleteDownload = { destination, marker };
    const download = FileSystem.createDownloadResumable(manifest.apkUrl, destination, {}, (progress) => {
      options.onProgress?.({
        bytesWritten: progress.totalBytesWritten,
        totalBytes: progress.totalBytesExpectedToWrite > 0 ? progress.totalBytesExpectedToWrite : null,
      });
    });
    const cancelDownload = () => void download.cancelAsync().catch(() => undefined);
    options.signal?.addEventListener('abort', cancelDownload, { once: true });
    let result;
    try {
      result = await download.downloadAsync();
    } finally {
      options.signal?.removeEventListener('abort', cancelDownload);
    }
    if (!result || options.signal?.aborted) {
      throw cancelledError();
    }
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`APK 下载失败，服务器返回 ${result.status}`);
    }

    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists || fileInfo.isDirectory || fileInfo.size <= 0) throw new Error('下载的 APK 文件为空');
    await FileSystem.writeAsStringAsync(marker, JSON.stringify({
      apkUrl: manifest.apkUrl,
      size: fileInfo.size,
      versionCode: manifest.versionCode,
    }));
    downloadCompleted = true;
    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    if (options.signal?.aborted) throw cancelledError();
    const installResult = await apkInstaller.installApkAsync(contentUri);
    writePersistentLog('INFO', 'update.install.finished', { result: installResult });
    return { status: installResult, contentUri };
  } catch (cause) {
    if (incompleteDownload && !downloadCompleted) await deleteUpdateFiles(incompleteDownload.destination, incompleteDownload.marker).catch(() => undefined);
    const normalizedCause = options.signal?.aborted ? cancelledError() : cause;
    if (normalizedCause instanceof Error && normalizedCause.name === 'AbortError') {
      writePersistentLog('INFO', 'update.install.cancelled', { versionCode: manifest.versionCode, versionName: manifest.versionName });
    } else {
      writePersistentError('update.install.failed', normalizedCause, { versionCode: manifest.versionCode, versionName: manifest.versionName });
    }
    throw normalizedCause;
  }
}

export async function installDownloadedAndroidUpdate(contentUri: string) {
  if (Platform.OS !== 'android' || !apkInstaller) throw new Error('当前环境不支持 APK 更新');
  return apkInstaller.installApkAsync(contentUri);
}

function parseManifest(value: unknown): AndroidUpdateManifest {
  if (!isRecord(value)) throw new Error('更新清单格式无效');
  const { versionCode, versionName, apkUrl, releaseNotes } = value;
  if (!Number.isInteger(versionCode) || (versionCode as number) <= 0) throw new Error('更新清单的 versionCode 无效');
  if (typeof versionName !== 'string' || !versionName.trim()) throw new Error('更新清单的 versionName 无效');
  if (typeof apkUrl !== 'string') throw new Error('更新清单的 apkUrl 无效');
  assertHttpsUrl(apkUrl, 'APK 下载地址');
  if (releaseNotes !== undefined && typeof releaseNotes !== 'string') throw new Error('更新清单的 releaseNotes 无效');
  return { versionCode: versionCode as number, versionName: versionName.trim(), apkUrl, releaseNotes: releaseNotes?.trim() || undefined };
}

function assertHttpsUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}无效`);
  }
  if (url.protocol !== 'https:') throw new Error(`${label}必须使用 HTTPS`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function getCachedUpdateContentUri(destination: string, marker: string, manifest: AndroidUpdateManifest) {
  try {
    const [fileInfo, markerInfo] = await Promise.all([
      FileSystem.getInfoAsync(destination),
      FileSystem.getInfoAsync(marker),
    ]);
    if (!fileInfo.exists || fileInfo.isDirectory || fileInfo.size <= 0 || !markerInfo.exists || markerInfo.isDirectory) return null;
    const metadata: unknown = JSON.parse(await FileSystem.readAsStringAsync(marker));
    if (!isRecord(metadata)
      || metadata.versionCode !== manifest.versionCode
      || metadata.apkUrl !== manifest.apkUrl
      || metadata.size !== fileInfo.size) return null;
    return FileSystem.getContentUriAsync(destination);
  } catch {
    return null;
  }
}

async function deleteUpdateFiles(destination: string, marker: string) {
  await Promise.all([
    FileSystem.deleteAsync(destination, { idempotent: true }),
    FileSystem.deleteAsync(marker, { idempotent: true }),
  ]);
}

function cancelledError() {
  const error = new Error('下载已取消');
  error.name = 'AbortError';
  return error;
}
