import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { writePersistentError, writePersistentLog } from '../../infrastructure/platform/persistent-log';

const GITHUB_RELEASE_BASE_URL = 'https://github.com/wh131462/StillAlive/releases/latest/download';

interface AndroidUpdateSource {
  name: string;
  manifestUrl: string;
  resolveApkUrl(manifest: AndroidUpdateManifest): string;
}

export const ANDROID_UPDATE_SOURCES: readonly AndroidUpdateSource[] = [
  {
    name: 'GitHub Proxy',
    manifestUrl: `https://gh-proxy.com/${GITHUB_RELEASE_BASE_URL}/latest.json`,
    resolveApkUrl: (manifest) => `https://gh-proxy.com/${GITHUB_RELEASE_BASE_URL}/still-alive-pro-v${manifest.versionName}.apk`,
  },
  {
    name: 'GitHub',
    manifestUrl: `${GITHUB_RELEASE_BASE_URL}/latest.json`,
    resolveApkUrl: (manifest) => `${GITHUB_RELEASE_BASE_URL}/still-alive-pro-v${manifest.versionName}.apk`,
  },
];

export interface AndroidUpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  apkUrls?: string[];
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
  const sources = ANDROID_UPDATE_SOURCES.filter((source) => source.manifestUrl.trim());
  if (!sources.length) {
    writePersistentLog('WARN', 'update.check.finished', { status: 'not-configured' });
    return { status: 'not-configured' };
  }

  try {
    const checks = await Promise.all(sources.map(async (source) => {
      try {
        return { manifest: await fetchAndroidUpdateManifest(source), source };
      } catch (cause) {
        writePersistentLog('WARN', 'update.check.source-failed', { error: errorMessage(cause), source: source.name });
        return { cause, source };
      }
    }));
    const successfulChecks = checks.filter((check): check is { manifest: AndroidUpdateManifest; source: AndroidUpdateSource } => 'manifest' in check);
    if (!successfulChecks.length) {
      const lastCause = checks.at(-1)?.cause;
      throw lastCause instanceof Error ? lastCause : new Error('所有更新源均不可用');
    }
    const selectedCheck = successfulChecks.reduce((selected, check) => check.manifest.versionCode > selected.manifest.versionCode ? check : selected);
    const manifest = resolveManifestDownloadSources(selectedCheck.manifest, selectedCheck.source, sources);
    const result: AndroidUpdateCheckResult = manifest.versionCode > getCurrentAndroidVersion().versionCode
      ? { status: 'available', manifest }
      : { status: 'current' };
    writePersistentLog('INFO', 'update.check.finished', { source: selectedCheck.source.name, status: result.status, versionCode: manifest.versionCode, versionName: manifest.versionName });
    return result;
  } catch (cause) {
    writePersistentError('update.check.failed', cause);
    throw cause;
  }
}

export async function downloadAndInstallAndroidUpdate(
  manifest: AndroidUpdateManifest,
  options: AndroidUpdateDownloadOptions = {},
): Promise<AndroidUpdateInstallResult> {
  try {
    if (Platform.OS !== 'android' || !apkInstaller) throw new Error('当前环境不支持 APK 更新');
    writePersistentLog('INFO', 'update.install.started', { versionCode: manifest.versionCode, versionName: manifest.versionName });
    const apkUrls = getManifestApkUrls(manifest);
    if (!FileSystem.cacheDirectory) throw new Error('无法访问应用缓存目录');

    const destination = `${FileSystem.cacheDirectory}still-alive-${manifest.versionCode}.apk`;
    const marker = `${destination}.complete.json`;
    const partialMarker = `${destination}.partial.json`;
    if (options.signal?.aborted) throw cancelledError();
    const cachedContentUri = await getCachedUpdateContentUri(destination, marker, manifest);
    if (options.signal?.aborted) throw cancelledError();
    if (cachedContentUri) {
      writePersistentLog('INFO', 'update.download.cache-hit', { versionCode: manifest.versionCode, versionName: manifest.versionName });
      const installResult = await apkInstaller.installApkAsync(cachedContentUri);
      writePersistentLog('INFO', 'update.install.finished', { result: installResult, cached: true });
      return { status: installResult, contentUri: cachedContentUri };
    }

    let downloadedUri: string | null = null;
    let downloadedApkUrl: string | null = null;
    let lastCause: unknown;
    for (const apkUrl of apkUrls) {
      try {
        downloadedUri = await downloadAndroidUpdateApk(apkUrl, destination, marker, partialMarker, manifest, options);
        downloadedApkUrl = apkUrl;
        break;
      } catch (cause) {
        if (options.signal?.aborted || (cause instanceof Error && cause.name === 'AbortError')) throw cause;
        lastCause = cause;
        writePersistentLog('WARN', 'update.download.source-failed', { apkUrl, error: errorMessage(cause), versionCode: manifest.versionCode });
        await deleteUpdateFiles(destination, marker, partialMarker);
      }
    }
    if (!downloadedUri || !downloadedApkUrl) throw lastCause instanceof Error ? lastCause : new Error('所有 APK 下载源均不可用');

    const fileInfo = await FileSystem.getInfoAsync(downloadedUri);
    if (!fileInfo.exists || fileInfo.isDirectory || fileInfo.size <= 0) throw new Error('下载的 APK 文件为空');
    await FileSystem.writeAsStringAsync(marker, JSON.stringify({
      apkUrl: downloadedApkUrl,
      size: fileInfo.size,
      versionCode: manifest.versionCode,
    }));
    await FileSystem.deleteAsync(partialMarker, { idempotent: true });
    const contentUri = await FileSystem.getContentUriAsync(downloadedUri);
    if (options.signal?.aborted) throw cancelledError();
    const installResult = await apkInstaller.installApkAsync(contentUri);
    writePersistentLog('INFO', 'update.install.finished', { result: installResult });
    return { status: installResult, contentUri };
  } catch (cause) {
    const normalizedCause = options.signal?.aborted ? cancelledError() : cause;
    if (normalizedCause instanceof Error && normalizedCause.name === 'AbortError') {
      writePersistentLog('INFO', 'update.install.cancelled', { versionCode: manifest.versionCode, versionName: manifest.versionName });
    } else {
      writePersistentError('update.install.failed', normalizedCause, { versionCode: manifest.versionCode, versionName: manifest.versionName });
    }
    throw normalizedCause;
  }
}

async function fetchAndroidUpdateManifest(source: AndroidUpdateSource) {
  assertHttpsUrl(source.manifestUrl, '更新服务器地址');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(source.manifestUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`更新服务器返回 ${response.status}`);
    return parseManifest(await response.json());
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') throw new Error(`${source.name} 检查更新超时`);
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveManifestDownloadSources(manifest: AndroidUpdateManifest, preferredSource: AndroidUpdateSource, sources: AndroidUpdateSource[]): AndroidUpdateManifest {
  const orderedSources = [preferredSource, ...sources.filter((source) => source !== preferredSource)];
  const apkUrls = [...new Set(orderedSources.map((source) => source.resolveApkUrl(manifest)))];
  apkUrls.forEach((apkUrl) => assertHttpsUrl(apkUrl, 'APK 下载地址'));
  return { ...manifest, apkUrl: apkUrls[0], apkUrls };
}

function getManifestApkUrls(manifest: AndroidUpdateManifest) {
  const apkUrls = [...new Set([...(manifest.apkUrls || []), manifest.apkUrl].filter(Boolean))];
  if (!apkUrls.length) throw new Error('没有可用的 APK 下载地址');
  apkUrls.forEach((apkUrl) => assertHttpsUrl(apkUrl, 'APK 下载地址'));
  return apkUrls;
}

async function downloadAndroidUpdateApk(
  apkUrl: string,
  destination: string,
  marker: string,
  partialMarker: string,
  manifest: AndroidUpdateManifest,
  options: AndroidUpdateDownloadOptions,
) {
  let resumeData = await getPartialUpdateResumeData(destination, partialMarker, manifest, apkUrl);
  while (true) {
    if (resumeData) {
      await FileSystem.deleteAsync(marker, { idempotent: true });
      const bytesWritten = Number(resumeData);
      options.onProgress?.({ bytesWritten, totalBytes: null });
      writePersistentLog('INFO', 'update.download.resumed', { apkUrl, bytesWritten, versionCode: manifest.versionCode });
    } else {
      await deleteUpdateFiles(destination, marker, partialMarker);
      await writePartialUpdateMarker(partialMarker, manifest, apkUrl);
    }
    if (options.signal?.aborted) throw cancelledError();

    const resumed = Boolean(resumeData);
    const download = FileSystem.createDownloadResumable(apkUrl, destination, {}, (progress) => {
      options.onProgress?.({
        bytesWritten: progress.totalBytesWritten,
        totalBytes: progress.totalBytesExpectedToWrite > 0 ? progress.totalBytesExpectedToWrite : null,
      });
    }, resumeData);
    let pausePromise: Promise<void> | null = null;
    const pauseDownload = () => {
      pausePromise ??= download.pauseAsync()
        .then(() => undefined)
        .catch(() => download.cancelAsync().catch(() => undefined));
    };
    options.signal?.addEventListener('abort', pauseDownload, { once: true });
    let result;
    try {
      result = await download.downloadAsync();
    } finally {
      options.signal?.removeEventListener('abort', pauseDownload);
    }
    if (!result) {
      await pausePromise;
      throw cancelledError();
    }
    if (resumed && (result.status === 200 || result.status === 416)) {
      if (options.signal?.aborted) throw cancelledError();
      resumeData = undefined;
      continue;
    }
    if (result.status < 200 || result.status >= 300) throw new Error(`APK 下载失败，服务器返回 ${result.status}`);
    return result.uri;
  }
}

async function getPartialUpdateResumeData(destination: string, marker: string, manifest: AndroidUpdateManifest, apkUrl: string) {
  try {
    const [fileInfo, markerInfo] = await Promise.all([
      FileSystem.getInfoAsync(destination),
      FileSystem.getInfoAsync(marker),
    ]);
    if (!fileInfo.exists || fileInfo.isDirectory || fileInfo.size <= 0 || !markerInfo.exists || markerInfo.isDirectory) return undefined;
    const metadata: unknown = JSON.parse(await FileSystem.readAsStringAsync(marker));
    if (!isRecord(metadata)
      || metadata.versionCode !== manifest.versionCode
      || metadata.apkUrl !== apkUrl) return undefined;
    return String(fileInfo.size);
  } catch {
    return undefined;
  }
}

async function writePartialUpdateMarker(marker: string, manifest: AndroidUpdateManifest, apkUrl: string) {
  await FileSystem.writeAsStringAsync(marker, JSON.stringify({
    apkUrl,
    versionCode: manifest.versionCode,
  }));
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

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
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
      || typeof metadata.apkUrl !== 'string'
      || !getManifestApkUrls(manifest).includes(metadata.apkUrl)
      || metadata.size !== fileInfo.size) return null;
    return FileSystem.getContentUriAsync(destination);
  } catch {
    return null;
  }
}

async function deleteUpdateFiles(...uris: string[]) {
  await Promise.all(uris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })));
}

function cancelledError() {
  const error = new Error('下载已取消');
  error.name = 'AbortError';
  return error;
}
