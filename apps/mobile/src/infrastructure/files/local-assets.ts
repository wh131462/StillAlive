import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { BookFormat, Media } from '@still-alive/types';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.ncm', '.qmc0', '.qmc2', '.qmc3', '.qmc4', '.qmc6', '.qmc8', '.qmcflac', '.qmcogg', '.mgg', '.mgg1', '.mggl', '.mflac', '.mflac0', '.mflach', '.kgm', '.kgma']);
const ENCRYPTED_AUDIO_EXTENSIONS = new Set(['.ncm', '.qmc0', '.qmc2', '.qmc3', '.qmc4', '.qmc6', '.qmc8', '.qmcflac', '.qmcogg', '.mgg', '.mgg1', '.mggl', '.mflac', '.mflac0', '.mflach', '.kgm', '.kgma']);
const REJECTED_AUDIO_EXTENSIONS = new Set(['.kgg']);
const BOOK_EXTENSIONS = new Map<string, BookFormat>([
  ['.pdf', 'pdf'],
  ['.epub', 'epub'],
  ['.mobi', 'mobi'],
  ['.txt', 'txt'],
  ['.html', 'html'],
  ['.htm', 'html'],
  ['.fb2', 'fb2'],
]);
const MAX_AUDIO_BYTES = 512 * 1024 * 1024;
let assetPickerInProgress = false;

export type ImportedAssetKind = 'audio' | 'book';

interface LocalAssetSource {
  file: File;
  name: string;
  mimeType: string | null;
}

export function extensionOf(name: string): string {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? '';
}

export function isSupportedAudioName(name: string): boolean {
  return AUDIO_EXTENSIONS.has(extensionOf(name)) || isEncryptedAudioName(name);
}
function isRejectedAudioName(name: string): boolean {
  return REJECTED_AUDIO_EXTENSIONS.has(extensionOf(name)) || /\.kgg\.(?:flac|mp3)$/i.test(name);
}
export function isEncryptedAudioName(name: string): boolean {
  const lower = name.toLowerCase();
  return ENCRYPTED_AUDIO_EXTENSIONS.has(extensionOf(lower)) || /\.(mgg\d*|mflac\d*)\.(flac|ogg|mp3|m4a)$/i.test(lower);
}

function encryptedContainerExtension(name: string): string {
  const lower = name.toLowerCase();
  const chained = lower.match(/\.(mgg\d*|mflac\d*)\.(?:flac|ogg|mp3|m4a)$/i);
  if (chained) return chained[1].startsWith('mgg') ? '.mgg' : '.mflac';
  return extensionOf(lower);
}

export type LocalAudioFormat = {
  extension: '.mp3' | '.flac' | '.ogg' | '.m4a' | '.wav' | '.aac';
  mimeType: 'audio/mpeg' | 'audio/flac' | 'audio/ogg' | 'audio/mp4' | 'audio/wav' | 'audio/aac';
};

/**
 * Read only a small prefix. The full audio payload never crosses the JS bridge.
 */
export function probeAudioHeader(header: Uint8Array): LocalAudioFormat | null {
  if (header.length >= 3 && header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
    return { extension: '.mp3', mimeType: 'audio/mpeg' };
  }
  if (header.length >= 2 && header[0] === 0xff && (header[1] & 0xf0) === 0xf0 && (header[1] & 0x06) === 0) {
    return { extension: '.aac', mimeType: 'audio/aac' };
  }
  if (header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0 && (header[1] & 0x06) !== 0) {
    return { extension: '.mp3', mimeType: 'audio/mpeg' };
  }
  if (header.length >= 4 && header[0] === 0x66 && header[1] === 0x4c && header[2] === 0x61 && header[3] === 0x43) {
    return { extension: '.flac', mimeType: 'audio/flac' };
  }
  if (header.length >= 4 && header[0] === 0x4f && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) {
    return { extension: '.ogg', mimeType: 'audio/ogg' };
  }
  if (header.length >= 12 && header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
    && header[8] === 0x57 && header[9] === 0x41 && header[10] === 0x56 && header[11] === 0x45) {
    return { extension: '.wav', mimeType: 'audio/wav' };
  }
  if (header.length >= 16 && header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) {
    const majorBrand = String.fromCharCode(header[8], header[9], header[10], header[11]);
    const compatibleBrands = [];
    for (let offset = 16; offset + 4 <= Math.min(header.length, readBoxSize(header)); offset += 4) {
      compatibleBrands.push(String.fromCharCode(header[offset], header[offset + 1], header[offset + 2], header[offset + 3]));
    }
    if (majorBrand === 'M4A ' || compatibleBrands.includes('M4A ')) return { extension: '.m4a', mimeType: 'audio/mp4' };
  }
  return null;
}

function readBoxSize(header: Uint8Array): number {
  if (header.length < 4) return 0;
  const size = (((header[0] << 24) >>> 0) | (header[1] << 16) | (header[2] << 8) | header[3]) >>> 0;
  return size >= 16 && size % 4 === 0 ? size : 0;
}

export async function probeAudioFile(file: File): Promise<LocalAudioFormat | null> {
  if (!file.exists || file.size <= 0) return null;
  const handle = file.open(FileMode.ReadOnly);
  try {
    return probeAudioHeader(handle.readBytes(4096));
  } finally {
    handle.close();
  }
}
export function isSupportedBookName(name: string): boolean { return BOOK_EXTENSIONS.has(extensionOf(name)); }
export function bookFormatFromName(name: string): BookFormat | null {
  return BOOK_EXTENSIONS.get(extensionOf(name)) ?? null;
}

async function copyLocalAssets(kind: ImportedAssetKind, sources: LocalAssetSource[]): Promise<Media[]> {
  const destinations: File[] = [];
  try {
    const directory = new Directory(Paths.document, kind === 'audio' ? 'media' : 'books');
    directory.create({ idempotent: true, intermediates: true });
    const temporaryAudioDirectory = new Directory(Paths.cache, 'music-imports');
    if (kind === 'audio') temporaryAudioDirectory.create({ idempotent: true, intermediates: true });
    const imported: Media[] = [];
    for (const source of sources) {
      const id = `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const extension = extensionOf(source.name);
      const encrypted = kind === 'audio' && isEncryptedAudioName(source.name);
      const storageExtension = encrypted ? encryptedContainerExtension(source.name) : extension;
      const destination = new File(encrypted ? temporaryAudioDirectory : directory, `${id}${storageExtension}`);
      destinations.push(destination);
      await source.file.copy(destination);
      if (!destination.exists || destination.size <= 0) throw new Error('文件为空或无法读取');
      if (kind === 'audio' && destination.size > MAX_AUDIO_BYTES) throw new Error('音频文件超过 512 MB 限制');
      const audioFormat = kind === 'audio' && !encrypted ? await probeAudioFile(destination) : null;
      if (kind === 'audio' && !encrypted && !audioFormat) throw new Error('音频文件头无法识别或文件已损坏');
      let storedDestination = destination;
      if (audioFormat && audioFormat.extension !== extension) {
        storedDestination = new File(directory, `${id}${audioFormat.extension}`);
        destinations.push(storedDestination);
        await destination.move(storedDestination);
      }
      const checksum = storedDestination.md5;
      if (!checksum) throw new Error('无法校验文件内容');
      imported.push({
        id,
        localPath: storedDestination.uri,
        mimeType: encrypted ? 'application/octet-stream' : audioFormat?.mimeType ?? source.mimeType ?? 'application/octet-stream',
        width: null,
        height: null,
        checksum,
        createdAt: new Date().toISOString(),
        kind,
        originalName: source.name,
        sizeBytes: storedDestination.size,
      });
    }
    return imported;
  } catch (cause) {
    for (const destination of destinations) if (destination.exists) destination.delete();
    throw cause;
  }
}

async function pickLocalAssets(kind: ImportedAssetKind, multiple: boolean): Promise<Media[]> {
  if (assetPickerInProgress) return [];
  assetPickerInProgress = true;
  try {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple,
      type: kind === 'audio' ? ['audio/*', 'application/octet-stream'] : ['application/pdf', 'application/epub+zip', 'application/x-mobipocket-ebook', 'text/plain', 'text/html', 'application/xhtml+xml', 'application/xml', 'text/xml', 'application/octet-stream'],
    });
    if (result.canceled) return [];
    const sources = result.assets.map((asset) => ({ file: new File(asset.uri), name: asset.name, mimeType: asset.mimeType ?? null }));
    try {
      if (kind === 'audio' && result.assets.some((asset) => isRejectedAudioName(asset.name))) {
        throw new Error('酷狗 KGG 需要外部密钥数据库，当前版本不支持');
      }
      const valid = result.assets.every((asset) => kind === 'audio' ? isSupportedAudioName(asset.name) : isSupportedBookName(asset.name));
      if (!valid) throw new Error(kind === 'audio' ? '只支持 mp3、m4a、aac、wav、flac 或 ogg 音频' : '只支持 PDF、EPUB、无 DRM MOBI、TXT、HTML 或 FB2 书籍');
      return await copyLocalAssets(kind, sources);
    } finally {
      for (const source of sources) {
        try {
          if (source.file.uri.startsWith(Paths.cache.uri) && source.file.exists) source.file.delete();
        } catch {
          // 系统可在应用退出后回收无法立即删除的 picker 缓存。
        }
      }
    }
  } finally {
    assetPickerInProgress = false;
  }
}

function listBookFiles(directory: Directory, visited = new Set<string>()): File[] {
  if (visited.has(directory.uri)) return [];
  visited.add(directory.uri);
  return directory.list().flatMap((entry) => {
    if (entry instanceof Directory) return listBookFiles(entry, visited);
    return isSupportedBookName(entry.name) ? [entry] : [];
  });
}

function isPickerCancellation(cause: unknown): boolean {
  return cause instanceof Error && cause.message.toLocaleLowerCase().includes('cancel');
}

export async function pickLocalAsset(kind: ImportedAssetKind): Promise<Media | null> {
  return (await pickLocalAssets(kind, false))[0] ?? null;
}

export async function pickLocalAudioAssets(): Promise<Media[]> {
  return pickLocalAssets('audio', true);
}

export async function pickLocalBookAssets(): Promise<Media[]> {
  return pickLocalAssets('book', true);
}

export async function pickLocalBooksFromDirectory(): Promise<Media[]> {
  if (assetPickerInProgress) return [];
  assetPickerInProgress = true;
  try {
    const directory = await Directory.pickDirectoryAsync();
    const files = listBookFiles(directory);
    if (!files.length) throw new Error('所选目录中没有可导入的书籍');
    return copyLocalAssets('book', files.map((file) => ({ file, name: file.name, mimeType: file.type || null })));
  } catch (cause) {
    if (isPickerCancellation(cause)) return [];
    throw cause;
  } finally {
    assetPickerInProgress = false;
  }
}
