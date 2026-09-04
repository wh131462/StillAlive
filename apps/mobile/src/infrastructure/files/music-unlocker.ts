import { requireNativeModule } from 'expo-modules-core';

export interface MusicUnlockResult {
  extension: string;
  mimeType: string;
  sizeBytes: number;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  coverMimeType?: string | null;
  coverPath?: string | null;
}

export interface MusicCoverExtractResult {
  coverMimeType?: string | null;
  coverPath?: string | null;
  sizeBytes?: number | null;
}

interface StillAliveMusicUnlockerModule {
  unlock(inputPath: string, outputPath: string): Promise<MusicUnlockResult>;
  extractCover?: (inputPath: string, outputPath: string) => Promise<MusicCoverExtractResult | null>;
}

let nativeModule: StillAliveMusicUnlockerModule | null | undefined;

function getNativeModule(): StillAliveMusicUnlockerModule {
  if (nativeModule !== undefined) {
    if (!nativeModule) throw new Error('当前构建未包含音乐解锁原生模块，请使用 development build');
    return nativeModule;
  }
  try {
    nativeModule = requireNativeModule<StillAliveMusicUnlockerModule>('StillAliveMusicUnlocker');
  } catch {
    nativeModule = null;
  }
  return getNativeModule();
}

export function unlockMusicFile(inputPath: string, outputPath: string): Promise<MusicUnlockResult> {
  return getNativeModule().unlock(inputPath, outputPath);
}

/**
 * Ask the platform media stack for artwork when a format-specific parser did
 * not find an embedded image. Older development builds do not expose this
 * optional method, so a miss must never prevent audio import.
 */
export async function extractMusicCover(inputPath: string, outputPath: string): Promise<MusicCoverExtractResult | null> {
  let module: StillAliveMusicUnlockerModule;
  try {
    module = getNativeModule();
  } catch {
    return null;
  }
  const extractor = module.extractCover;
  if (!extractor) return null;
  try {
    return await extractor(inputPath, outputPath);
  } catch {
    return null;
  }
}
