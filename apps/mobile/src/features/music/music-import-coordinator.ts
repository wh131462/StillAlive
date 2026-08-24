import { Directory, File, Paths } from 'expo-file-system';
import type { Media, MusicCollectionEntry, MusicTrack } from '@still-alive/types';
import type { StillAliveRepository } from '../../infrastructure/database/repository-contract';
import { unlockMusicFile } from '../../infrastructure/files/music-unlocker';
import { probeAudioFile } from '../../infrastructure/files/local-assets';
import { extractEmbeddedMusicCover } from '../../infrastructure/files/music-cover-metadata';
import { writePersistentError } from '../../infrastructure/platform/persistent-log';

const ENCRYPTED_EXTENSIONS = new Set([
  '.ncm', '.qmc0', '.qmc2', '.qmc3', '.qmc4', '.qmc6', '.qmc8', '.qmcflac', '.qmcogg',
  '.mgg', '.mgg1', '.mggl', '.mflac', '.mflac0', '.mflach', '.kgm', '.kgma',
]);

export function isEncryptedMusicName(name: string): boolean {
  const lower = name.toLowerCase();
  const extension = lower.match(/\.[a-z0-9]+$/)?.[0] ?? '';
  return ENCRYPTED_EXTENSIONS.has(extension) || /\.(mgg\d*|mflac\d*)\.(flac|ogg|mp3|m4a)$/i.test(lower);
}

interface MusicImportFailureContext {
  importedCount?: number;
  joinedPlaylist?: boolean;
  sourceName?: string | null;
}

export function reportMusicImportFailure(cause: unknown, context: MusicImportFailureContext = {}): { title: string; message: string } {
  const sourceName = context.sourceName ?? null;
  const importedCount = context.importedCount ?? 0;
  writePersistentError('music.import.failed', cause, {
    encrypted: sourceName ? isEncryptedMusicName(sourceName) : undefined,
    importedCount,
    sourceName,
  });

  const prefix = importedCount > 0
    ? `已成功导入${context.joinedPlaylist ? '并加入歌单' : ''} ${importedCount} 首。\n\n`
    : '';
  const failure = musicImportFailureMessage(cause, sourceName);
  return { title: failure.title, message: `${prefix}${failure.message}` };
}

function musicImportFailureMessage(cause: unknown, sourceName: string | null): { title: string; message: string } {
  const detail = cause instanceof Error ? cause.message : '';
  const lowerDetail = detail.toLocaleLowerCase();
  const lowerName = sourceName?.toLocaleLowerCase() ?? '';

  if (/原下载设备|musicex|stag/i.test(detail)) {
    return {
      title: '这首 QQ 音乐暂时无法导入',
      message: '该文件与原下载设备绑定，需要那台设备上的 QQ 音乐本地密钥。当前应用无法访问该密钥，请改用已解密的 MP3 或 FLAC 文件。',
    };
  }
  if (/外部密钥|\.kgg(?:\.|$)/i.test(`${detail} ${lowerName}`)) {
    return {
      title: '这个酷狗音乐文件暂时无法导入',
      message: 'KGG 文件需要原设备上的额外密钥数据库，当前应用无法读取。请改用从原平台导出的普通 MP3 或 FLAC 文件。',
    };
  }
  if (/原生模块|development build|stillalivemusicunlocker|native module/i.test(detail)) {
    return {
      title: '当前版本缺少音乐解锁组件',
      message: '请更新或重新安装应用后再试。普通 MP3 或 FLAC 文件仍可直接导入。',
    };
  }
  if (/512\s*mb|文件过大|超过.*限制|too large/i.test(detail)) {
    return {
      title: '这个音频文件太大',
      message: '单个音频文件不能超过 512 MB，请选择较小的文件。',
    };
  }
  if (/no space|enospc|存储空间|空间不足/i.test(lowerDetail)) {
    return {
      title: '设备存储空间不足',
      message: '请清理一些设备存储空间后再重新导入。',
    };
  }
  if (/\.(?:kgm|kgma)$/i.test(lowerName)) {
    return {
      title: '这个酷狗音乐文件无法导入',
      message: '该文件使用当前不支持的加密版本，或文件内容不完整。请从原平台重新下载，或改用普通 MP3 或 FLAC 文件。',
    };
  }
  if (/\.ncm$/i.test(lowerName)) {
    return {
      title: '这个网易云音乐文件无法导入',
      message: '该文件可能不完整或已经损坏。请从原平台重新下载，或改用普通 MP3 或 FLAC 文件。',
    };
  }
  if (isEncryptedMusicName(lowerName)) {
    return {
      title: '这个加密音乐文件无法导入',
      message: '该文件可能使用了当前不支持的加密版本，或文件内容不完整。请改用普通 MP3 或 FLAC 文件。',
    };
  }
  if (/只支持|文件头|无法识别|格式不受支持|文件已损坏|unsupported|invalid.*(?:audio|format|magic)/i.test(detail)) {
    return {
      title: '无法读取这个音频文件',
      message: '请选择可正常播放的 MP3、M4A、AAC、WAV、FLAC 或 OGG 文件；当前文件可能格式不受支持或已经损坏。',
    };
  }
  return {
    title: '音乐导入未完成',
    message: '文件没有加入曲库，请稍后重试。若仍然失败，可在“关于”页面导出诊断日志。',
  };
}

export async function importEncryptedMusicTrack(
  source: Media,
  repository: StillAliveRepository,
  personId: string | null,
): Promise<{ media: Media; track: MusicTrack }> {
  if (!isEncryptedMusicName(source.originalName ?? '')) throw new Error('不是受支持的加密音乐容器');
  if (personId && !(await repository.listPeople()).some((person) => person.id === personId)) throw new Error('人物不存在或已删除');

  const input = new File(source.localPath);
  if (!input.exists || input.size <= 0) throw new Error('加密音乐文件为空或已失效');
  const temporaryDirectory = new Directory(Paths.cache, 'music-imports');
  temporaryDirectory.create({ idempotent: true, intermediates: true });
  const operationId = `unlock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const temporaryOutput = new File(temporaryDirectory, `${operationId}.decoded`);
  const mediaDirectory = new Directory(Paths.document, 'media');
  mediaDirectory.create({ idempotent: true, intermediates: true });
  let destination: File | null = null;

  try {
    const unlocked = await unlockMusicFile(input.uri, temporaryOutput.uri);
    const extension = normalizeDecodedExtension(unlocked.extension);
    if (!extension || !isValidatedAudioMime(unlocked.mimeType)) throw new Error('格式不受支持或文件已损坏');
    if (!temporaryOutput.exists || temporaryOutput.size <= 0) throw new Error('解码输出为空');
    const detected = await probeAudioFile(temporaryOutput);
    if (!detected || detected.extension !== extension || detected.mimeType !== unlocked.mimeType) {
      throw new Error('格式不受支持或文件已损坏');
    }

    const mediaId = `media_${operationId}`;
    destination = new File(mediaDirectory, `${mediaId}${extension}`);
    await temporaryOutput.move(destination);
    if (!destination.exists || destination.size <= 0) throw new Error('无法保存解码后的音频');
    const now = new Date().toISOString();
    const media: Media = {
      id: mediaId,
      localPath: destination.uri,
      mimeType: unlocked.mimeType,
      width: null,
      height: null,
      checksum: destination.md5 ?? '',
      createdAt: now,
      kind: 'audio',
      originalName: `${unlocked.title || source.originalName?.replace(/\.[^.]+$/, '') || '未命名音乐'}${extension}`,
      sizeBytes: destination.size,
    };
    if (!media.checksum) throw new Error('无法校验解码后的音频');
    const track: MusicTrack = {
      id: `track_${operationId}`,
      mediaId: media.id,
      coverMediaId: null,
      title: unlocked.title?.trim() || source.originalName?.replace(/\.[^.]+$/, '') || '未命名音乐',
      artist: unlocked.artist?.trim() || null,
      album: unlocked.album?.trim() || null,
      durationMs: null,
      playCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const collections: MusicCollectionEntry[] = [
      { trackId: track.id, targetType: 'self', targetId: null, createdAt: now },
      ...(personId ? [{ trackId: track.id, targetType: 'person' as const, targetId: personId, createdAt: now }] : []),
    ];
    let coverMedia: Media | null = null;
    try {
      coverMedia = await extractEmbeddedMusicCover(media);
      track.coverMediaId = coverMedia?.id ?? null;
      await repository.importMusicTrack(media, track, collections, coverMedia);
      return { media, track };
    } catch (cause) {
      if (coverMedia) {
        const coverFile = new File(coverMedia.localPath);
        if (coverFile.exists) coverFile.delete();
      }
      throw cause;
    }
  } catch (cause) {
    if (destination?.exists) destination.delete();
    if (temporaryOutput.exists) temporaryOutput.delete();
    throw cause;
  } finally {
    if (input.exists) input.delete();
  }
}

function normalizeDecodedExtension(extension: string): string {
  const normalized = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  return new Set(['.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac']).has(normalized) ? normalized : '';
}

function isValidatedAudioMime(mimeType: string): boolean {
  return new Set(['audio/mpeg', 'audio/flac', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/aac']).has(mimeType.toLowerCase());
}
