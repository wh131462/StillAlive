import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import type { BookFormat, Media } from '@still-alive/types';
import type { Parser } from 'rebook';
import { epub } from 'rebook/parsers/epub';
import { fb2 } from 'rebook/parsers/fb2';
import { mobi } from 'rebook/parsers/mobi';
import { MobileDOMAdapter, MobileURLFactory } from '../../features/bookshelf/book-reflow-adapter';

const MAX_COVER_BYTES = 20 * 1024 * 1024;

interface PdfThumbnailModule {
  renderFirstPageAsync(inputUri: string, outputUri: string, width: number): Promise<{ width: number; height: number }>;
}

const pdfThumbnail = requireOptionalNativeModule<PdfThumbnailModule>('StillAliveBookCover');

export async function extractBookCover(source: Media, format: BookFormat): Promise<Media | null> {
  if (format === 'pdf') return renderPdfCover(source.localPath);
  if (format !== 'epub' && format !== 'mobi' && format !== 'fb2') return null;

  const bytes = await new File(source.localPath).bytes();
  if (!bytes.length) return null;
  const book = await parserFor(format).parse(toArrayBuffer(bytes), {
    domAdapter: new MobileDOMAdapter(),
    urlFactory: new MobileURLFactory(),
  });
  try {
    const cover = await book.getCover?.();
    if (!cover || cover.size <= 0 || cover.size > MAX_COVER_BYTES) return null;
    const coverBytes = await readBlobBytes(cover);
    return persistCover(coverBytes, cover.type);
  } finally {
    book.destroy?.();
  }
}

async function renderPdfCover(inputUri: string): Promise<Media | null> {
  if (!pdfThumbnail) return null;
  const id = createMediaId();
  const directory = mediaDirectory();
  const destination = new File(directory, `${id}.png`);
  try {
    const dimensions = await pdfThumbnail.renderFirstPageAsync(inputUri, destination.uri, 720);
    if (!destination.exists || destination.size <= 0 || destination.size > MAX_COVER_BYTES || !destination.md5) {
      if (destination.exists) destination.delete();
      return null;
    }
    return mediaFromFile(id, destination, 'image/png', dimensions.width, dimensions.height);
  } catch {
    if (destination.exists) destination.delete();
    return null;
  }
}

function persistCover(bytes: Uint8Array, declaredMimeType: string): Media | null {
  const image = detectImage(bytes, declaredMimeType);
  if (!image || bytes.length > MAX_COVER_BYTES) return null;
  const id = createMediaId();
  const destination = new File(mediaDirectory(), `${id}${image.extension}`);
  destination.create({ intermediates: true });
  destination.write(bytes);
  if (!destination.exists || destination.size <= 0 || !destination.md5) {
    if (destination.exists) destination.delete();
    return null;
  }
  return mediaFromFile(id, destination, image.mimeType, null, null);
}

function detectImage(bytes: Uint8Array, declaredMimeType: string): { extension: string; mimeType: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: '.jpg', mimeType: 'image/jpeg' };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { extension: '.png', mimeType: 'image/png' };
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return { extension: '.webp', mimeType: 'image/webp' };
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')) return { extension: '.gif', mimeType: 'image/gif' };
  if (declaredMimeType === 'image/svg+xml' || ascii(bytes, 0, Math.min(bytes.length, 256)).includes('<svg')) return null;
  return null;
}

function parserFor(format: 'epub' | 'mobi' | 'fb2'): Parser {
  if (format === 'epub') return epub();
  if (format === 'mobi') return mobi();
  return fb2();
}

function mediaDirectory(): Directory {
  const directory = new Directory(Paths.document, 'media');
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function mediaFromFile(id: string, file: File, mimeType: string, width: number | null, height: number | null): Media {
  return {
    id,
    localPath: file.uri,
    mimeType,
    width,
    height,
    checksum: file.md5 ?? '',
    createdAt: new Date().toISOString(),
    kind: 'image',
    originalName: `book-cover${file.extension}`,
    sizeBytes: file.size,
  };
}

function createMediaId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('无法读取封面图片'));
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(new Uint8Array(reader.result))
      : reject(new Error('封面图片数据无效'));
    reader.readAsArrayBuffer(blob);
  });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
