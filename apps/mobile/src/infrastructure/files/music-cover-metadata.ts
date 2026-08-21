import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { Media } from '@still-alive/types';

const MAX_ID3_TAG_BYTES = 16 * 1024 * 1024;

/** Extracts the first APIC image from a common ID3v2 MP3 tag. */
export async function extractEmbeddedMusicCover(audio: Media): Promise<Media | null> {
  if (!audio.localPath.toLowerCase().endsWith('.mp3')) return null;
  const source = new File(audio.localPath);
  if (!source.exists || source.size < 10) return null;
  const handle = source.open(FileMode.ReadOnly);
  try {
    const header = handle.readBytes(10);
    if (!isId3Header(header)) return null;
    const tagSize = readSyncSafe(header, 6);
    if (!tagSize || tagSize > MAX_ID3_TAG_BYTES || 10 + tagSize > source.size) return null;
    handle.offset = 10;
    const tag = handle.readBytes(tagSize);
    const image = findApicImage((header[5] & 0x80) !== 0 ? removeUnsynchronisation(tag) : tag, header[3], header[5]);
    if (!image) return null;

    const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const extension = image.mimeType === 'image/png' ? '.png' : image.mimeType === 'image/webp' ? '.webp' : '.jpg';
    const directory = new Directory(Paths.document, 'media');
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, `${id}${extension}`);
    destination.create({ intermediates: true });
    destination.write(image.bytes);
    if (!destination.exists || destination.size <= 0 || !destination.md5) {
      if (destination.exists) destination.delete();
      return null;
    }
    return {
      id,
      localPath: destination.uri,
      mimeType: image.mimeType,
      width: null,
      height: null,
      checksum: destination.md5,
      createdAt: new Date().toISOString(),
      kind: 'image',
      originalName: `embedded-cover${extension}`,
      sizeBytes: destination.size,
    };
  } finally {
    handle.close();
  }
}

function isId3Header(header: Uint8Array): boolean {
  return header.length >= 10 && header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33 && header[3] >= 2 && header[3] <= 4;
}

function findApicImage(tag: Uint8Array, version: number, flags: number): { mimeType: string; bytes: Uint8Array } | null {
  let offset = extendedHeaderSize(tag, version, flags);
  while (offset + (version === 2 ? 6 : 10) <= tag.length) {
    const frameHeaderSize = version === 2 ? 6 : 10;
    const id = ascii(tag, offset, version === 2 ? 3 : 4);
    if (!id || id.charCodeAt(0) === 0) break;
    const frameSize = version === 2
      ? readUInt24(tag, offset + 3)
      : version === 4 ? readSyncSafe(tag, offset + 4) : readUInt32(tag, offset + 4);
    if (!frameSize || offset + frameHeaderSize + frameSize > tag.length) break;
    const data = tag.slice(offset + frameHeaderSize, offset + frameHeaderSize + frameSize);
    if (id === 'APIC' || id === 'PIC') {
      const image = version === 2 ? parsePic(data) : parseApic(data);
      if (image) return image;
    }
    offset += frameHeaderSize + frameSize;
  }
  return null;
}

function extendedHeaderSize(tag: Uint8Array, version: number, flags: number): number {
  if ((flags & 0x40) === 0 || tag.length < 4) return 0;
  if (version === 3) return Math.min(tag.length, 4 + readUInt32(tag, 0));
  if (version === 4) return Math.min(tag.length, readSyncSafe(tag, 0));
  return 0;
}

function parseApic(data: Uint8Array): { mimeType: string; bytes: Uint8Array } | null {
  if (data.length < 4) return null;
  const encoding = data[0];
  const mimeEnd = findZero(data, 1, 1);
  if (mimeEnd < 0) return null;
  const pictureTypeIndex = mimeEnd + 1;
  if (pictureTypeIndex >= data.length) return null;
  const descriptionStart = pictureTypeIndex + 1;
  const descriptionEnd = findZero(data, descriptionStart, encoding === 1 || encoding === 2 ? 2 : 1);
  if (descriptionEnd < 0) return null;
  const bytes = data.slice(descriptionEnd + (encoding === 1 || encoding === 2 ? 2 : 1));
  const mimeType = normalizeImageMime(bytes);
  return mimeType ? { mimeType, bytes } : null;
}

function parsePic(data: Uint8Array): { mimeType: string; bytes: Uint8Array } | null {
  if (data.length < 6) return null;
  const descriptionEnd = findZero(data, 5, data[0] === 1 || data[0] === 2 ? 2 : 1);
  if (descriptionEnd < 0) return null;
  const bytes = data.slice(descriptionEnd + (data[0] === 1 || data[0] === 2 ? 2 : 1));
  const mimeType = normalizeImageMime(bytes);
  return mimeType ? { mimeType, bytes } : null;
}

function normalizeImageMime(bytes: Uint8Array): string | null {
  const detected = sniffImageMime(bytes);
  return detected || null;
}

function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  return '';
}

function findZero(bytes: Uint8Array, start: number, width: number): number {
  for (let index = start; index + width <= bytes.length; index += width) {
    let empty = true;
    for (let cursor = 0; cursor < width; cursor += 1) if (bytes[index + cursor] !== 0) empty = false;
    if (empty) return index;
  }
  return -1;
}

function removeUnsynchronisation(bytes: Uint8Array): Uint8Array {
  const output = new Uint8Array(bytes.length);
  let length = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    output[length] = bytes[index];
    length += 1;
    if (bytes[index] === 0xff && bytes[index + 1] === 0x00) index += 1;
  }
  return output.slice(0, length);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function readSyncSafe(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] & 0x7f) << 21) | ((bytes[offset + 1] & 0x7f) << 14) | ((bytes[offset + 2] & 0x7f) << 7) | (bytes[offset + 3] & 0x7f);
}

function readUInt24(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function readUInt32(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}
