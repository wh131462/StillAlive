import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * 后续填写返回版本清单 JSON 的 HTTPS 地址。
 * 响应字段：versionCode、versionName、apkUrl，可选 releaseNotes。
 */
export const ANDROID_UPDATE_MANIFEST_URL = '';

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
  if (Platform.OS !== 'android' || !apkInstaller) return { status: 'unsupported' };
  if (!ANDROID_UPDATE_MANIFEST_URL.trim()) return { status: 'not-configured' };

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
    return manifest.versionCode > getCurrentAndroidVersion().versionCode
      ? { status: 'available', manifest }
      : { status: 'current' };
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') throw new Error('检查更新超时');
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadAndInstallAndroidUpdate(manifest: AndroidUpdateManifest) {
  if (Platform.OS !== 'android' || !apkInstaller) throw new Error('当前环境不支持 APK 更新');
  assertHttpsUrl(manifest.apkUrl, 'APK 下载地址');
  if (!FileSystem.cacheDirectory) throw new Error('无法访问应用缓存目录');

  const destination = `${FileSystem.cacheDirectory}still-alive-${manifest.versionCode}.apk`;
  await FileSystem.deleteAsync(destination, { idempotent: true });
  const result = await FileSystem.downloadAsync(manifest.apkUrl, destination);
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw new Error(`APK 下载失败，服务器返回 ${result.status}`);
  }

  const contentUri = await FileSystem.getContentUriAsync(result.uri);
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
