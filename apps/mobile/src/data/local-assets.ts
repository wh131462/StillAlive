import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import type { BookFormat, Media } from '@still-alive/types';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg']);
const BOOK_EXTENSIONS = new Set(['.pdf', '.epub', '.mobi', '.azw', '.azw3']);

export type ImportedAssetKind = 'audio' | 'book';

export function extensionOf(name: string): string {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? '';
}

export function isSupportedAudioName(name: string): boolean { return AUDIO_EXTENSIONS.has(extensionOf(name)); }
export function isSupportedBookName(name: string): boolean { return BOOK_EXTENSIONS.has(extensionOf(name)); }
export function bookFormatFromName(name: string): BookFormat | null {
  const extension = extensionOf(name).slice(1);
  return BOOK_EXTENSIONS.has(`.${extension}`) ? extension as BookFormat : null;
}

export async function pickLocalAsset(kind: ImportedAssetKind): Promise<Media | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: kind === 'audio' ? 'audio/*' : ['application/pdf', 'application/epub+zip', 'application/x-mobipocket-ebook', 'application/octet-stream'],
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const valid = kind === 'audio' ? isSupportedAudioName(asset.name) : isSupportedBookName(asset.name);
  if (!valid) throw new Error(kind === 'audio' ? '只支持 mp3、m4a、aac、wav、flac 或 ogg 音频' : '只支持 PDF、EPUB、MOBI、AZW 或 AZW3 书籍');

  const directory = new Directory(Paths.document, kind === 'audio' ? 'media' : 'books');
  directory.create({ idempotent: true, intermediates: true });
  const id = `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const extension = extensionOf(asset.name);
  const destination = new File(directory, `${id}${extension}`);
  try {
    await new File(asset.uri).copy(destination);
    if (!destination.exists || destination.size <= 0) throw new Error('文件为空或无法读取');
    return {
      id,
      localPath: destination.uri,
      mimeType: asset.mimeType ?? (kind === 'audio' ? `audio/${extension.slice(1)}` : 'application/octet-stream'),
      width: null,
      height: null,
      checksum: destination.md5 ?? '',
      createdAt: new Date().toISOString(),
      kind,
      originalName: asset.name,
      sizeBytes: destination.size,
    };
  } catch (cause) {
    if (destination.exists) destination.delete();
    throw cause;
  }
}
