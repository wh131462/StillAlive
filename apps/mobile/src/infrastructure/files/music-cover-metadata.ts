import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { FileHandle } from 'expo-file-system';
import type { Media } from '@still-alive/types';
import { extractMusicCover } from './music-unlocker';

const MAX_TAG_BYTES = 32 * 1024 * 1024;
const MAX_TEXT_BYTES = 64 * 1024;
const MAX_TEXT_LENGTH = 4_096;
const OGG_FLAC_MAPPING_HEADER_SIZE = 9;
const OGG_FLAC_NATIVE_MARKER_SIZE = 4;

interface EmbeddedImage {
  bytes: Uint8Array;
  mimeType: string;
  pictureType: number;
}

interface ParsedMusicMetadata {
  album: string | null;
  artist: string | null;
  image: EmbeddedImage | null;
  title: string | null;
}

export interface EmbeddedMusicMetadata {
  album: string | null;
  artist: string | null;
  cover: Media | null;
  title: string | null;
}

const EMPTY_METADATA: ParsedMusicMetadata = { album: null, artist: null, image: null, title: null };

export async function readEmbeddedMusicMetadata(audio: Media, sourceUri?: string | null): Promise<EmbeddedMusicMetadata> {
  const source = new File(audio.localPath);
  let parsed = EMPTY_METADATA;
  let handle: FileHandle | null = null;
  if (source.exists && (source.size ?? 0) > 0) {
    try {
      handle = source.open(FileMode.ReadOnly);
      const fileSize = source.size ?? 0;
      const header = readAt(handle, fileSize, 0, 64);
      parsed = isAscii(header, 0, 'fLaC')
        ? parseFlac(handle, fileSize)
        : isAscii(header, 0, 'OggS')
          ? parseOgg(handle, fileSize)
          : isAscii(header, 0, 'RIFF') && isAscii(header, 8, 'WAVE')
            ? parseWav(handle, fileSize)
            : isAscii(header, 4, 'ftyp')
              ? parseMp4(handle, fileSize)
              : isAscii(header, 0, 'ID3') || isMpegAudioHeader(header)
                ? parseId3File(handle, fileSize, true)
                : isAdtsHeader(header)
                  ? parseId3File(handle, fileSize, false)
                  : EMPTY_METADATA;
    } catch {
      // A malformed tag should not prevent the platform artwork probe below.
      parsed = EMPTY_METADATA;
    } finally {
      handle?.close();
    }
  }
  let cover: Media | null = null;
  try {
    if (parsed.image) cover = persistCover(parsed.image);
  } catch {
    // Keep metadata import usable when a single cover cannot be persisted.
  }
  if (!cover) cover = await extractNativeCover(audio, sourceUri);
  return { album: parsed.album, artist: parsed.artist, cover, title: parsed.title };
}

export async function persistMusicCoverFile(file: File, mimeTypeHint?: string | null): Promise<Media | null> {
  if (!file.exists || file.size <= 0 || file.size > MAX_TAG_BYTES) return null;
  const bytes = await file.bytes();
  const mimeType = sniffImageMime(bytes) || normalizeImageMime(mimeTypeHint ?? null);
  return mimeType ? persistCover({ bytes, mimeType, pictureType: 3 }) : null;
}

function parseId3File(handle: FileHandle, fileSize: number, includeId3v1: boolean): ParsedMusicMetadata {
  let parsed = EMPTY_METADATA;
  const header = readAt(handle, fileSize, 0, 10);
  if (isId3Header(header)) {
    const size = readSyncSafe(header, 6);
    if (size > 0 && size <= MAX_TAG_BYTES && size + 10 <= fileSize) {
      const tag = readAt(handle, fileSize, 10, size);
      parsed = parseId3Tag((header[5] & 0x80) !== 0 ? removeUnsynchronisation(tag) : tag, header[3], header[5]);
    }
  }
  if (includeId3v1 && fileSize >= 128) {
    const id3v1 = readAt(handle, fileSize, fileSize - 128, 128);
    if (isAscii(id3v1, 0, 'TAG')) {
      parsed = mergeMetadata(parsed, {
        album: decodeLatin1(id3v1.slice(63, 93)),
        artist: decodeLatin1(id3v1.slice(33, 63)),
        image: null,
        title: decodeLatin1(id3v1.slice(3, 33)),
      });
    }
  }
  return mergeMetadata(parsed, parseApeFooter(handle, fileSize));
}

function parseApeFooter(handle: FileHandle, fileSize: number): ParsedMusicMetadata {
  if (fileSize < 32) return EMPTY_METADATA;
  const id3v1Offset = fileSize >= 128 && isAscii(readAt(handle, fileSize, fileSize - 128, 3), 0, 'TAG') ? fileSize - 128 : fileSize;
  const footerOffset = id3v1Offset - 32;
  if (footerOffset < 0) return EMPTY_METADATA;
  const footer = readAt(handle, fileSize, footerOffset, 32);
  if (!isAscii(footer, 0, 'APETAGEX')) return EMPTY_METADATA;
  const size = readUInt32LE(footer, 12);
  const itemCount = Math.min(readUInt32LE(footer, 16), 10_000);
  if (size < 32 || size > MAX_TAG_BYTES || size > fileSize) return EMPTY_METADATA;
  const tag = readAt(handle, fileSize, id3v1Offset - size, size);
  if (tag.length !== size) return EMPTY_METADATA;
  let offset = (readUInt32LE(footer, 20) & 0x8000_0000) !== 0 ? 32 : 0;
  let parsed = EMPTY_METADATA;
  for (let index = 0; index < itemCount && offset + 8 <= tag.length; index += 1) {
    const valueSize = readUInt32LE(tag, offset);
    offset += 8;
    if (valueSize > MAX_TAG_BYTES || offset + valueSize > tag.length) break;
    const keyEnd = findZero(tag, offset, 1);
    if (keyEnd < 0 || keyEnd >= tag.length) break;
    const key = decodeLatin1(tag.slice(offset, keyEnd))?.toUpperCase() ?? '';
    offset = keyEnd + 1;
    const valueBytes = tag.slice(offset, offset + valueSize);
    offset += valueSize;
    if (!key) continue;
    if (key === 'COVER ART (FRONT)' || key === 'COVER ART') {
      const binaryStart = findZero(valueBytes, 0, 1);
      const imageBytes = binaryStart >= 0 ? valueBytes.slice(binaryStart + 1) : valueBytes;
      const mimeType = sniffImageMime(imageBytes);
      if (mimeType && !parsed.image) parsed = { ...parsed, image: { bytes: imageBytes, mimeType, pictureType: 3 } };
      continue;
    }
    const value = cleanText(decodeUtf8(valueBytes)) || cleanText(decodeLatin1(valueBytes) ?? '');
    if (!value) continue;
    if (key === 'TITLE' && !parsed.title) parsed = { ...parsed, title: value };
    if ((key === 'ARTIST' || key === 'ALBUM ARTIST' || key === 'ALBUMARTIST') && !parsed.artist) parsed = { ...parsed, artist: value };
    if (key === 'ALBUM' && !parsed.album) parsed = { ...parsed, album: value };
  }
  return parsed;
}

function parseId3Bytes(bytes: Uint8Array): ParsedMusicMetadata {
  if (!isId3Header(bytes) || bytes.length < 10) return EMPTY_METADATA;
  const size = readSyncSafe(bytes, 6);
  if (!size || size > MAX_TAG_BYTES || size + 10 > bytes.length) return EMPTY_METADATA;
  const tag = bytes.slice(10, 10 + size);
  return parseId3Tag((bytes[5] & 0x80) !== 0 ? removeUnsynchronisation(tag) : tag, bytes[3], bytes[5]);
}

function parseId3Tag(tag: Uint8Array, version: number, flags: number): ParsedMusicMetadata {
  if (version < 2 || version > 4 || (version === 2 && (flags & 0x40) !== 0)) return EMPTY_METADATA;
  let parsed = EMPTY_METADATA;
  let albumArtist: string | null = null;
  let offset = extendedId3HeaderSize(tag, version, flags);
  const frameHeaderSize = version === 2 ? 6 : 10;
  while (offset + frameHeaderSize <= tag.length) {
    const id = ascii(tag, offset, version === 2 ? 3 : 4);
    if (!id || id.charCodeAt(0) === 0 || !/^[A-Z0-9]{3,4}$/.test(id)) break;
    const size = version === 2
      ? readUInt24BE(tag, offset + 3)
      : version === 4 ? readSyncSafe(tag, offset + 4) : readUInt32BE(tag, offset + 4);
    if (!size || offset + frameHeaderSize + size > tag.length) break;
    const formatFlags = version === 2 ? 0 : tag[offset + 9];
    const frame = normalizeId3Frame(tag.slice(offset + frameHeaderSize, offset + frameHeaderSize + size), version, formatFlags);
    if (frame) {
      const text = id[0] === 'T' && id !== 'TXXX' ? decodeId3Text(frame) : null;
      if ((id === 'TIT2' || id === 'TT2') && text) parsed = { ...parsed, title: parsed.title ?? text };
      if ((id === 'TPE1' || id === 'TP1') && text) parsed = { ...parsed, artist: parsed.artist ?? text };
      if (id === 'TPE2' && text) albumArtist ??= text;
      if ((id === 'TALB' || id === 'TAL') && text) parsed = { ...parsed, album: parsed.album ?? text };
      if (id === 'APIC' || id === 'PIC') {
        const image = version === 2 ? parsePic(frame) : parseApic(frame);
        if (image && (!parsed.image || image.pictureType === 3)) parsed = { ...parsed, image };
      }
    }
    offset += frameHeaderSize + size;
  }
  return parsed.artist || !albumArtist ? parsed : { ...parsed, artist: albumArtist };
}

function normalizeId3Frame(frame: Uint8Array, version: number, flags: number): Uint8Array | null {
  let offset = 0;
  if (version === 3) {
    if ((flags & 0xc0) !== 0) return null;
    if ((flags & 0x20) !== 0) offset += 1;
  } else if (version === 4) {
    if ((flags & 0x0c) !== 0) return null;
    if ((flags & 0x40) !== 0) offset += 1;
    if ((flags & 0x01) !== 0) offset += 4;
  }
  if (offset >= frame.length) return null;
  const value = frame.slice(offset);
  return version === 4 && (flags & 0x02) !== 0 ? removeUnsynchronisation(value) : value;
}

function parseFlac(handle: FileHandle, fileSize: number): ParsedMusicMetadata {
  let parsed = EMPTY_METADATA;
  let offset = 4;
  for (let blockIndex = 0; blockIndex < 128 && offset + 4 <= fileSize; blockIndex += 1) {
    const header = readAt(handle, fileSize, offset, 4);
    if (header.length < 4) break;
    const last = (header[0] & 0x80) !== 0;
    const type = header[0] & 0x7f;
    const size = readUInt24BE(header, 1);
    if (size > MAX_TAG_BYTES || offset + 4 + size > fileSize) break;
    if (type === 4 || type === 6) parsed = mergeFlacMetadata(parsed, parseFlacMetadataBlock(type, readAt(handle, fileSize, offset + 4, size)));
    offset += 4 + size;
    if (last) break;
  }
  return parsed;
}

function parseOgg(handle: FileHandle, fileSize: number): ParsedMusicMetadata {
  let offset = 0;
  let packetChunks: Uint8Array[] = [];
  let packetSize = 0;
  let oggFlac = false;
  let oggFlacMetadataComplete = false;
  let oggFlacPending: Uint8Array<ArrayBufferLike> = new Uint8Array();
  let parsed = EMPTY_METADATA;
  for (let pageIndex = 0; pageIndex < 4_096 && offset + 27 <= fileSize; pageIndex += 1) {
    const header = readAt(handle, fileSize, offset, 27);
    if (!isAscii(header, 0, 'OggS')) break;
    const segmentCount = header[26];
    const lacing = readAt(handle, fileSize, offset + 27, segmentCount);
    if (lacing.length !== segmentCount) break;
    const bodySize = lacing.reduce((total, value) => total + value, 0);
    const body = readAt(handle, fileSize, offset + 27 + segmentCount, bodySize);
    if (body.length !== bodySize) break;
    let bodyOffset = 0;
    for (const length of lacing) {
      if (packetSize + length > MAX_TAG_BYTES) return EMPTY_METADATA;
      if (length > 0) {
        packetChunks.push(body.slice(bodyOffset, bodyOffset + length));
        packetSize += length;
      }
      bodyOffset += length;
      if (length < 255) {
        const packet = concatBytes(packetChunks, packetSize);
        if (isAscii(packet, 0, '\x7fFLAC')) {
          oggFlac = true;
          const start = oggFlacMetadataStart(packet);
          const metadataBytes = packet.slice(start);
          const result = parseOggFlacMetadata(metadataBytes, 0);
          parsed = mergeFlacMetadata(parsed, result.metadata);
          oggFlacMetadataComplete = result.complete;
          oggFlacPending = result.complete ? new Uint8Array() : metadataBytes;
        } else if (oggFlac && !oggFlacMetadataComplete) {
          // A few muxers emit the native marker as the first bytes of a
          // follow-up metadata packet instead of keeping it in the mapping
          // packet.
          const start = isAscii(packet, 0, 'fLaC') ? OGG_FLAC_NATIVE_MARKER_SIZE : 0;
          const metadataBytes = packet.slice(start);
          if (oggFlacPending.length + metadataBytes.length > MAX_TAG_BYTES) return EMPTY_METADATA;
          const combined = oggFlacPending.length
            ? concatBytes([oggFlacPending, metadataBytes], oggFlacPending.length + metadataBytes.length)
            : metadataBytes;
          const result = parseOggFlacMetadata(combined, 0);
          parsed = mergeFlacMetadata(parsed, result.metadata);
          oggFlacMetadataComplete = result.complete;
          oggFlacPending = result.complete ? new Uint8Array() : combined;
        } else if (!oggFlac && isAscii(packet, 0, '\x03vorbis')) {
          return mergeMetadata(parsed, parseVorbisComments(packet, 7));
        } else if (!oggFlac && isAscii(packet, 0, 'OpusTags')) {
          return mergeMetadata(parsed, parseVorbisComments(packet, 8));
        }
        packetChunks = [];
        packetSize = 0;
      }
    }
    offset += 27 + segmentCount + bodySize;
  }
  return parsed;
}

function parseOggFlacMetadata(packet: Uint8Array, start: number): { complete: boolean; metadata: ParsedMusicMetadata } {
  let offset = start;
  let metadata = EMPTY_METADATA;
  while (offset + 4 <= packet.length) {
    const header = packet.slice(offset, offset + 4);
    const last = (header[0] & 0x80) !== 0;
    const type = header[0] & 0x7f;
    const size = readUInt24BE(header, 1);
    offset += 4;
    if (size > MAX_TAG_BYTES || offset + size > packet.length) return { complete: false, metadata };
    if (type === 4 || type === 6) metadata = mergeMetadata(metadata, parseFlacMetadataBlock(type, packet.slice(offset, offset + size)));
    offset += size;
    if (last) return { complete: true, metadata };
  }
  return { complete: false, metadata };
}

function parseFlacMetadataBlock(type: number, block: Uint8Array): ParsedMusicMetadata {
  if (type === 4) return parseVorbisComments(block, 0);
  if (type === 6) {
    const image = parsePictureBlock(block);
    return image ? { ...EMPTY_METADATA, image } : EMPTY_METADATA;
  }
  return EMPTY_METADATA;
}

function mergeFlacMetadata(primary: ParsedMusicMetadata, fallback: ParsedMusicMetadata): ParsedMusicMetadata {
  const merged = mergeMetadata(primary, fallback);
  if (fallback.image && (!primary.image || fallback.image.pictureType === 3)) merged.image = fallback.image;
  return merged;
}

function parseVorbisComments(bytes: Uint8Array, start: number): ParsedMusicMetadata {
  if (start + 8 > bytes.length) return EMPTY_METADATA;
  let offset = start;
  const vendorSize = readUInt32LE(bytes, offset);
  offset += 4 + vendorSize;
  if (offset + 4 > bytes.length) return EMPTY_METADATA;
  const count = Math.min(readUInt32LE(bytes, offset), 100_000);
  offset += 4;
  let parsed = EMPTY_METADATA;
  let coverArt: string | null = null;
  let coverArtMime: string | null = null;
  let albumArtist: string | null = null;
  for (let index = 0; index < count && offset + 4 <= bytes.length; index += 1) {
    const size = readUInt32LE(bytes, offset);
    offset += 4;
    if (size > MAX_TAG_BYTES || offset + size > bytes.length) break;
    const entry = decodeUtf8(bytes.slice(offset, offset + size));
    offset += size;
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).toUpperCase();
    const rawValue = entry.slice(separator + 1).trim();
    if (key === 'METADATA_BLOCK_PICTURE') {
      const image = parsePictureBlock(decodeBase64(rawValue));
      if (image && (!parsed.image || image.pictureType === 3)) parsed = { ...parsed, image };
      continue;
    }
    if (key === 'COVERART' && !coverArt) {
      coverArt = rawValue;
      continue;
    }
    const value = cleanText(rawValue);
    if (!value) continue;
    if (key === 'TITLE' && !parsed.title) parsed = { ...parsed, title: value };
    if (key === 'ARTIST' && !parsed.artist) parsed = { ...parsed, artist: value };
    if (key === 'ALBUMARTIST' && !albumArtist) albumArtist = value;
    if (key === 'ALBUM' && !parsed.album) parsed = { ...parsed, album: value };
    if (key === 'COVERARTMIME' && !coverArtMime) coverArtMime = value;
  }
  if (!parsed.image && coverArt) {
    const imageBytes = decodeBase64(coverArt);
    const mimeType = sniffImageMime(imageBytes) || normalizeImageMime(coverArtMime);
    if (mimeType) parsed = { ...parsed, image: { bytes: imageBytes, mimeType, pictureType: 3 } };
  }
  return parsed.artist || !albumArtist ? parsed : { ...parsed, artist: albumArtist };
}

function parseMp4(handle: FileHandle, fileSize: number): ParsedMusicMetadata {
  const parsed = { ...EMPTY_METADATA };
  walkMp4Boxes(handle, fileSize, 0, fileSize, 0, parsed);
  return parsed;
}

function walkMp4Boxes(handle: FileHandle, fileSize: number, start: number, end: number, depth: number, parsed: ParsedMusicMetadata): void {
  if (depth > 8) return;
  let offset = start;
  for (let boxIndex = 0; boxIndex < 100_000 && offset + 8 <= end; boxIndex += 1) {
    const box = readMp4Box(handle, fileSize, offset, end);
    if (!box) break;
    const payloadStart = offset + box.headerSize;
    if (box.type === 'ilst') parseMp4ItemList(handle, fileSize, payloadStart, box.end, parsed);
    else if (box.type === 'moov' || box.type === 'udta') walkMp4Boxes(handle, fileSize, payloadStart, box.end, depth + 1, parsed);
    else if (box.type === 'meta') walkMp4Boxes(handle, fileSize, payloadStart + 4, box.end, depth + 1, parsed);
    offset = box.end;
  }
}

function parseMp4ItemList(handle: FileHandle, fileSize: number, start: number, end: number, parsed: ParsedMusicMetadata): void {
  let offset = start;
  for (let itemIndex = 0; itemIndex < 10_000 && offset + 8 <= end; itemIndex += 1) {
    const item = readMp4Box(handle, fileSize, offset, end);
    if (!item) break;
    let childOffset = offset + item.headerSize;
    while (childOffset + 8 <= item.end) {
      const child = readMp4Box(handle, fileSize, childOffset, item.end);
      if (!child) break;
      if (child.type === 'data' && child.end - childOffset - child.headerSize >= 8) {
        const header = readAt(handle, fileSize, childOffset + child.headerSize, 8);
        const value = readAt(handle, fileSize, childOffset + child.headerSize + 8, child.end - childOffset - child.headerSize - 8);
        const dataType = readUInt24BE(header, 1);
        if ((item.type === '\xa9nam' || item.type === '\xa9ART' || item.type === 'aART' || item.type === '\xa9alb') && value.length <= MAX_TAG_BYTES) {
          const text = cleanText(dataType === 2 ? decodeUtf16(value, false) : decodeUtf8(value));
          if (item.type === '\xa9nam' && !parsed.title) parsed.title = text;
          if ((item.type === '\xa9ART' || item.type === 'aART') && !parsed.artist) parsed.artist = text;
          if (item.type === '\xa9alb' && !parsed.album) parsed.album = text;
        }
        if (item.type === 'covr' && !parsed.image && value.length <= MAX_TAG_BYTES) {
          const mimeType = sniffImageMime(value);
          if (mimeType) parsed.image = { bytes: value, mimeType, pictureType: 3 };
        }
      }
      childOffset = child.end;
    }
    offset = item.end;
  }
}

function parseWav(handle: FileHandle, fileSize: number): ParsedMusicMetadata {
  let parsed = EMPTY_METADATA;
  let offset = 12;
  for (let chunkIndex = 0; chunkIndex < 100_000 && offset + 8 <= fileSize; chunkIndex += 1) {
    const header = readAt(handle, fileSize, offset, 8);
    const type = ascii(header, 0, 4);
    const size = readUInt32LE(header, 4);
    const dataStart = offset + 8;
    if (dataStart + size > fileSize) break;
    if ((type === 'id3 ' || type === 'ID3 ') && size <= MAX_TAG_BYTES) {
      parsed = mergeMetadata(parsed, parseId3Bytes(readAt(handle, fileSize, dataStart, size)));
    } else if (type === 'LIST' && size >= 4 && size <= MAX_TAG_BYTES) {
      const list = readAt(handle, fileSize, dataStart, size);
      if (isAscii(list, 0, 'INFO')) parsed = mergeMetadata(parsed, parseRiffInfo(list.slice(4)));
    }
    offset = dataStart + size + (size % 2);
  }
  return parsed;
}

function parseRiffInfo(bytes: Uint8Array): ParsedMusicMetadata {
  let parsed = EMPTY_METADATA;
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const size = readUInt32LE(bytes, offset + 4);
    if (offset + 8 + size > bytes.length) break;
    const value = cleanText(decodeUtf8(bytes.slice(offset + 8, offset + 8 + size)));
    if (type === 'INAM' && !parsed.title) parsed = { ...parsed, title: value };
    if (type === 'IART' && !parsed.artist) parsed = { ...parsed, artist: value };
    if ((type === 'IPRD' || type === 'IALB') && !parsed.album) parsed = { ...parsed, album: value };
    offset += 8 + size + (size % 2);
  }
  return parsed;
}

function parsePictureBlock(bytes: Uint8Array): EmbeddedImage | null {
  if (bytes.length < 32) return null;
  const pictureType = readUInt32BE(bytes, 0);
  const mimeSize = readUInt32BE(bytes, 4);
  let offset = 8;
  if (mimeSize > bytes.length - offset) return null;
  const declaredMime = decodeUtf8(bytes.slice(offset, offset + mimeSize));
  offset += mimeSize;
  if (offset + 4 > bytes.length) return null;
  const descriptionSize = readUInt32BE(bytes, offset);
  offset += 4 + descriptionSize;
  if (offset + 20 > bytes.length) return null;
  offset += 16;
  const imageSize = readUInt32BE(bytes, offset);
  offset += 4;
  if (!imageSize || imageSize > MAX_TAG_BYTES || offset + imageSize > bytes.length) return null;
  const imageBytes = bytes.slice(offset, offset + imageSize);
  const mimeType = sniffImageMime(imageBytes) || normalizeImageMime(declaredMime);
  return mimeType ? { bytes: imageBytes, mimeType, pictureType } : null;
}

function parseApic(data: Uint8Array): EmbeddedImage | null {
  if (data.length < 4) return null;
  const encoding = data[0];
  const mimeEnd = findZero(data, 1, 1);
  if (mimeEnd < 0 || mimeEnd + 1 >= data.length) return null;
  const declaredMime = decodeLatin1(data.slice(1, mimeEnd));
  const pictureType = data[mimeEnd + 1];
  const descriptionStart = mimeEnd + 2;
  const width = encoding === 1 || encoding === 2 ? 2 : 1;
  const descriptionEnd = findZero(data, descriptionStart, width);
  if (descriptionEnd < 0) return null;
  const bytes = data.slice(descriptionEnd + width);
  const mimeType = sniffImageMime(bytes) || normalizeImageMime(declaredMime);
  return mimeType ? { bytes, mimeType, pictureType } : null;
}

function parsePic(data: Uint8Array): EmbeddedImage | null {
  // ID3v2.2 PIC stores a fixed three-byte image format (JPG/PNG/...) rather
  // than the NUL-terminated MIME string used by APIC.
  if (data.length < 6) return null;
  const pictureType = data[4];
  const width = data[0] === 1 || data[0] === 2 ? 2 : 1;
  const descriptionEnd = findZero(data, 5, width);
  if (descriptionEnd < 0) return null;
  const bytes = data.slice(descriptionEnd + width);
  const format = ascii(data, 1, 3).toUpperCase();
  const declaredMime = format === 'JPG' || format === 'JPEG'
    ? 'image/jpeg'
    : format === 'PNG' ? 'image/png'
      : format === 'GIF' ? 'image/gif'
        : format === 'WEB' || format === 'WEBP' ? 'image/webp'
          : format === 'BMP' ? 'image/bmp' : null;
  const mimeType = sniffImageMime(bytes) || normalizeImageMime(declaredMime);
  return mimeType ? { bytes, mimeType, pictureType } : null;
}

function persistCover(image: EmbeddedImage): Media | null {
  if (!image.bytes.length || image.bytes.length > MAX_TAG_BYTES) return null;
  const extension = imageExtension(image.mimeType);
  const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const directory = new Directory(Paths.document, 'media');
  const destination = new File(directory, `${id}${extension}`);
  try {
    directory.create({ idempotent: true, intermediates: true });
    destination.create({ intermediates: true });
    destination.write(image.bytes);
    if (!destination.exists || destination.size <= 0 || !destination.md5) {
      if (destination.exists) destination.delete();
      return null;
    }
  } catch {
    try {
      if (destination.exists) destination.delete();
    } catch {
      // Preserve the original persistence failure.
    }
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
}

async function extractNativeCover(audio: Media, sourceUri?: string | null): Promise<Media | null> {
  const directory = new Directory(Paths.cache, 'music-cover-probes');
  const operationId = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const output = new File(directory, `${operationId}.image`);
  const cacheDirectoryPath = fileUriPath(directory.uri);
  let returned: File | null = null;
  try {
    directory.create({ idempotent: true, intermediates: true });
    const probeUris = [audio.localPath, sourceUri].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
    for (const probeUri of probeUris) {
      const result = await extractMusicCover(probeUri, output.uri);
      if (!result?.coverPath && !output.exists) continue;
      const hinted = result?.coverPath ? new File(result.coverPath) : null;
      returned = hinted?.exists ? hinted : output.exists ? output : hinted;
      if (!returned?.exists) continue;
      const persisted = await persistMusicCoverFile(returned, result?.coverMimeType);
      if (persisted) return persisted;
      try { if (returned.exists) returned.delete(); } catch { /* best effort */ }
      returned = null;
    }
    return null;
  } catch {
    return null;
  } finally {
    for (const file of [returned, output]) {
      try {
        if (file && fileUriPath(file.uri).startsWith(`${cacheDirectoryPath}/`) && file.exists) file.delete();
      } catch {
        // Best-effort cleanup; the cache is reclaimed by the platform.
      }
    }
  }
}

function fileUriPath(uri: string): string {
  if (!uri.toLowerCase().startsWith('file:')) return uri;
  const path = decodeURIComponent(uri.replace(/^file:\/+/i, '/'));
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function readMp4Box(handle: FileHandle, fileSize: number, offset: number, parentEnd: number): { end: number; headerSize: number; type: string } | null {
  const header = readAt(handle, fileSize, offset, 16);
  if (header.length < 8) return null;
  let size = readUInt32BE(header, 0);
  let headerSize = 8;
  if (size === 1) {
    if (header.length < 16) return null;
    const high = readUInt32BE(header, 8);
    const low = readUInt32BE(header, 12);
    size = high * 0x1_0000_0000 + low;
    headerSize = 16;
  } else if (size === 0) size = parentEnd - offset;
  const end = offset + size;
  if (!Number.isSafeInteger(size) || size < headerSize || end > parentEnd || end > fileSize) return null;
  return { end, headerSize, type: ascii(header, 4, 4) };
}

function mergeMetadata(primary: ParsedMusicMetadata, fallback: ParsedMusicMetadata): ParsedMusicMetadata {
  return {
    album: primary.album ?? fallback.album,
    artist: primary.artist ?? fallback.artist,
    image: primary.image ?? fallback.image,
    title: primary.title ?? fallback.title,
  };
}

function decodeId3Text(data: Uint8Array): string | null {
  if (data.length < 2) return null;
  const encoding = data[0];
  const bytes = data.slice(1, MAX_TEXT_BYTES + 1);
  if (encoding === 0) return decodeLegacyText(bytes);
  if (encoding === 1) {
    const littleEndian = bytes[0] === 0xff && bytes[1] === 0xfe;
    const start = bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0xfe && bytes[1] === 0xff ? 2 : 0;
    return cleanText(decodeUtf16(bytes.slice(start), littleEndian));
  }
  if (encoding === 2) return cleanText(decodeUtf16(bytes, false));
  return cleanText(decodeUtf8(bytes));
}

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  let output = '';
  for (let offset = 0; offset + 1 < bytes.length; offset += 2) {
    const code = littleEndian ? bytes[offset] | (bytes[offset + 1] << 8) : (bytes[offset] << 8) | bytes[offset + 1];
    output += String.fromCharCode(code);
  }
  return output;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function decodeLatin1(bytes: Uint8Array): string | null {
  let output = '';
  for (const byte of bytes.slice(0, MAX_TEXT_BYTES)) output += String.fromCharCode(byte);
  return cleanText(output);
}

function decodeLegacyText(bytes: Uint8Array): string | null {
  const value = bytes.slice(0, MAX_TEXT_BYTES);
  if (isValidUtf8(value)) return cleanText(decodeUtf8(value));
  return decodeLatin1(value);
}

function isValidUtf8(bytes: Uint8Array): boolean {
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index];
    if (first < 0x80) { index += 1; continue; }
    const length = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
    if (!length || index + length > bytes.length) return false;
    for (let offset = 1; offset < length; offset += 1) if ((bytes[index + offset] & 0xc0) !== 0x80) return false;
    if (length === 3 && first === 0xe0 && bytes[index + 1] < 0xa0) return false;
    if (length === 3 && first === 0xed && bytes[index + 1] >= 0xa0) return false;
    if (length === 4 && first === 0xf0 && bytes[index + 1] < 0x90) return false;
    if (length === 4 && first === 0xf4 && bytes[index + 1] >= 0x90) return false;
    index += length;
  }
  return true;
}

function cleanText(value: string): string | null {
  const cleaned = value.replace(/^\uFEFF/, '').split(/\0+/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' / ');
  return cleaned ? cleaned.slice(0, MAX_TEXT_LENGTH) : null;
}

function decodeBase64(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleaned = value
    .replace(/^data:[^,]+,/i, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!cleaned || cleaned.length > Math.ceil(MAX_TAG_BYTES * 4 / 3) + 4) return new Uint8Array();
  const output = new Uint8Array(Math.floor(cleaned.length * 3 / 4));
  let buffer = 0;
  let bits = 0;
  let length = 0;
  for (const character of cleaned) {
    if (character === '=') break;
    const valueIndex = alphabet.indexOf(character);
    if (valueIndex < 0) return new Uint8Array();
    buffer = (buffer << 6) | valueIndex;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[length] = (buffer >> bits) & 0xff;
      length += 1;
    }
  }
  return output.slice(0, length);
}

function concatBytes(chunks: Uint8Array[], size: number): Uint8Array {
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function normalizeImageMime(value: string | null): string {
  const normalized = value?.replace(/\0/g, '').split(';', 1)[0].toLowerCase().trim() ?? '';
  if (normalized === 'image/jpg' || normalized === 'image/pjpeg') return 'image/jpeg';
  if (normalized === 'image/x-png') return 'image/png';
  if (normalized === 'image/x-ms-bmp') return 'image/bmp';
  if (normalized === 'image/heif') return 'image/heic';
  if (normalized === 'image/x-tiff') return 'image/tiff';
  if (normalized === 'image/jpx' || normalized === 'image/jpm' || normalized === 'image/jpeg2000') return 'image/jp2';
  return new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/avif', 'image/tiff', 'image/jp2']).has(normalized) ? normalized : '';
}

function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && isAscii(bytes, 1, 'PNG')) return 'image/png';
  if (bytes.length >= 12 && isAscii(bytes, 0, 'RIFF') && isAscii(bytes, 8, 'WEBP')) return 'image/webp';
  if (bytes.length >= 6 && (isAscii(bytes, 0, 'GIF87a') || isAscii(bytes, 0, 'GIF89a'))) return 'image/gif';
  if (bytes.length >= 2 && isAscii(bytes, 0, 'BM')) return 'image/bmp';
  if (bytes.length >= 8 && isAscii(bytes, 0, 'II*\x00')) return 'image/tiff';
  if (bytes.length >= 8 && isAscii(bytes, 0, 'MM\x00*')) return 'image/tiff';
  if (bytes.length >= 4 && (isAscii(bytes, 0, 'II+\x00') || isAscii(bytes, 0, 'MM\x00+'))) return 'image/tiff';
  if (bytes.length >= 12 && isAscii(bytes, 0, '\x00\x00\x00\x0cjP  \x0d\x0a\x87\x0a')) return 'image/jp2';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0x4f && bytes[2] === 0xff && bytes[3] === 0x51) return 'image/jp2';
  if (bytes.length >= 12 && isAscii(bytes, 4, 'ftyp')) {
    const brand = ascii(bytes, 8, 4);
    if (new Set(['heic', 'heix', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'heim', 'mif1', 'msf1']).has(brand)) return 'image/heic';
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return '';
}

function imageExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/png': return '.png';
    case 'image/webp': return '.webp';
    case 'image/gif': return '.gif';
    case 'image/bmp': return '.bmp';
    case 'image/heic': return '.heic';
    case 'image/avif': return '.avif';
    case 'image/tiff': return '.tiff';
    case 'image/jp2': return '.jp2';
    default: return '.jpg';
  }
}

/**
 * Ogg-FLAC has a nine-byte mapping header. Most encoders append the native
 * `fLaC` marker before the first metadata block; accept both layouts because
 * older muxers omit that marker.
 */
function oggFlacMetadataStart(packet: Uint8Array): number {
  const markerOffset = OGG_FLAC_MAPPING_HEADER_SIZE;
  return isAscii(packet, markerOffset, 'fLaC')
    ? markerOffset + OGG_FLAC_NATIVE_MARKER_SIZE
    : markerOffset;
}

function isId3Header(bytes: Uint8Array): boolean {
  return bytes.length >= 10 && isAscii(bytes, 0, 'ID3') && bytes[3] >= 2 && bytes[3] <= 4;
}

function extendedId3HeaderSize(tag: Uint8Array, version: number, flags: number): number {
  if ((flags & 0x40) === 0 || tag.length < 4) return 0;
  if (version === 3) return Math.min(tag.length, 4 + readUInt32BE(tag, 0));
  if (version === 4) return Math.min(tag.length, readSyncSafe(tag, 0));
  return 0;
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

function findZero(bytes: Uint8Array, start: number, width: number): number {
  for (let index = start; index + width <= bytes.length; index += width) {
    let empty = true;
    for (let cursor = 0; cursor < width; cursor += 1) if (bytes[index + cursor] !== 0) empty = false;
    if (empty) return index;
  }
  return -1;
}

function isMpegAudioHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0;
}

function isAdtsHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf0) === 0xf0 && (bytes[1] & 0x06) === 0;
}

function readAt(handle: FileHandle, fileSize: number, offset: number, length: number): Uint8Array {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length <= 0 || offset >= fileSize) return new Uint8Array();
  handle.offset = offset;
  return handle.readBytes(Math.min(length, fileSize - offset));
}

function ascii(bytes: Uint8Array, start: number, length: number): string;
function ascii(bytes: Uint8Array, start: number, value: string): boolean;
function ascii(bytes: Uint8Array, start: number, lengthOrValue: number | string): string | boolean {
  if (typeof lengthOrValue === 'string') {
    if (start < 0 || start + lengthOrValue.length > bytes.length) return false;
    for (let index = 0; index < lengthOrValue.length; index += 1) if (bytes[start + index] !== lengthOrValue.charCodeAt(index)) return false;
    return true;
  }
  return String.fromCharCode(...bytes.slice(start, start + lengthOrValue));
}

function isAscii(bytes: Uint8Array, offset: number, value: string): boolean {
  return ascii(bytes, offset, value) === true;
}

function readSyncSafe(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return ((bytes[offset] & 0x7f) << 21) | ((bytes[offset + 1] & 0x7f) << 14) | ((bytes[offset + 2] & 0x7f) << 7) | (bytes[offset + 3] & 0x7f);
}

function readUInt24BE(bytes: Uint8Array, offset: number): number {
  if (offset + 3 > bytes.length) return 0;
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readUInt32LE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | ((bytes[offset + 3] << 24) >>> 0)) >>> 0;
}
