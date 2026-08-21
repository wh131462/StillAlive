import { requireNativeModule } from 'expo-modules-core';

export interface MusicUnlockResult {
  extension: string;
  mimeType: string;
  sizeBytes: number;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
}

interface StillAliveMusicUnlockerModule {
  unlock(inputPath: string, outputPath: string): Promise<MusicUnlockResult>;
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
