import { File, FileMode } from 'expo-file-system';
import type { FileHandle } from 'expo-file-system';

export type AudioFileFormat = 'AAC' | 'FLAC' | 'M4A' | 'MP3' | 'OGG' | 'WAV';

export interface AudioFileMetadata {
  bitrateKbps: number | null;
  channels: number | null;
  durationMs: number | null;
  fileSizeBytes: number | null;
  format: AudioFileFormat | null;
  sampleRateHz: number | null;
}

type ParsedAudioMetadata = Omit<AudioFileMetadata, 'fileSizeBytes'>;

const EMPTY_METADATA: ParsedAudioMetadata = {
  bitrateKbps: null,
  channels: null,
  durationMs: null,
  format: null,
  sampleRateHz: null,
};

/** Reads only the container headers needed for the file-information sheet. */
export async function readAudioFileMetadata(localPath: string): Promise<AudioFileMetadata> {
  const file = new File(localPath);
  if (!file.exists || file.size <= 0) return { ...EMPTY_METADATA, fileSizeBytes: null };
  const handle = file.open(FileMode.ReadOnly);
  try {
    const header = readAt(handle, file.size, 0, 64);
    const parsed = isAscii(header, 0, 'fLaC')
      ? parseFlac(handle, file.size)
      : isAscii(header, 0, 'OggS')
        ? parseOgg(handle, file.size)
        : isAscii(header, 0, 'RIFF') && isAscii(header, 8, 'WAVE')
          ? parseWav(handle, file.size)
          : isAscii(header, 4, 'ftyp')
            ? parseM4a(handle, file.size)
            : isAscii(header, 0, 'ID3') || isMpegAudioHeader(header, 0)
              ? parseMp3(handle, file.size)
              : isAdtsHeader(header, 0)
                ? parseAac(handle, file.size)
                : EMPTY_METADATA;
    return { ...parsed, fileSizeBytes: file.size };
  } finally {
    handle.close();
  }
}

function parseFlac(handle: FileHandle, fileSize: number): ParsedAudioMetadata {
  let offset = 4;
  for (let blockIndex = 0; blockIndex < 64 && offset + 4 <= fileSize; blockIndex += 1) {
    const header = readAt(handle, fileSize, offset, 4);
    if (header.length < 4) break;
    const last = (header[0] & 0x80) !== 0;
    const type = header[0] & 0x7f;
    const length = readUInt24BE(header, 1);
    if (type === 0 && length >= 34) {
      const streamInfo = readAt(handle, fileSize, offset + 4, 34);
      if (streamInfo.length < 34) break;
      const sampleRateHz = (streamInfo[10] << 12) | (streamInfo[11] << 4) | (streamInfo[12] >> 4);
      const channels = ((streamInfo[12] & 0x0e) >> 1) + 1;
      const totalSamples = (streamInfo[13] & 0x0f) * 0x1_0000_0000
        + readUInt32BE(streamInfo, 14);
      return {
        bitrateKbps: null,
        channels,
        durationMs: sampleRateHz > 0 && totalSamples > 0 ? Math.round(totalSamples / sampleRateHz * 1_000) : null,
        format: 'FLAC',
        sampleRateHz: sampleRateHz || null,
      };
    }
    offset += 4 + length;
    if (last) break;
  }
  return { ...EMPTY_METADATA, format: 'FLAC' };
}

function parseWav(handle: FileHandle, fileSize: number): ParsedAudioMetadata {
  let offset = 12;
  let bitrateKbps: number | null = null;
  let byteRate = 0;
  let channels: number | null = null;
  let dataSize = 0;
  let sampleRateHz: number | null = null;
  for (let chunkIndex = 0; chunkIndex < 1_024 && offset + 8 <= fileSize; chunkIndex += 1) {
    const header = readAt(handle, fileSize, offset, 8);
    if (header.length < 8) break;
    const chunkSize = readUInt32LE(header, 4);
    if (isAscii(header, 0, 'fmt ')) {
      const format = readAt(handle, fileSize, offset + 8, Math.min(chunkSize, 40));
      if (format.length >= 16) {
        channels = readUInt16LE(format, 2) || null;
        sampleRateHz = readUInt32LE(format, 4) || null;
        byteRate = readUInt32LE(format, 8);
        bitrateKbps = byteRate > 0 ? Math.round(byteRate * 8 / 1_000) : null;
      }
    } else if (isAscii(header, 0, 'data')) {
      dataSize = Math.min(chunkSize, Math.max(0, fileSize - offset - 8));
    }
    offset += 8 + chunkSize + (chunkSize % 2);
    if (byteRate > 0 && dataSize > 0) break;
  }
  return {
    bitrateKbps,
    channels,
    durationMs: byteRate > 0 && dataSize > 0 ? Math.round(dataSize / byteRate * 1_000) : null,
    format: 'WAV',
    sampleRateHz,
  };
}

function parseMp3(handle: FileHandle, fileSize: number): ParsedAudioMetadata {
  const id3Header = readAt(handle, fileSize, 0, 10);
  const id3Size = isAscii(id3Header, 0, 'ID3') && id3Header.length >= 10
    ? 10 + readSyncSafe(id3Header, 6) + ((id3Header[5] & 0x10) !== 0 ? 10 : 0)
    : 0;
  const scan = readAt(handle, fileSize, id3Size, Math.min(128 * 1_024, fileSize - id3Size));
  for (let index = 0; index + 4 <= scan.length; index += 1) {
    const frame = readMpegFrame(scan, index);
    if (!frame) continue;
    const nextOffset = index + frame.length;
    if (nextOffset + 4 <= scan.length) {
      const next = readMpegFrame(scan, nextOffset);
      if (!next || next.version !== frame.version || next.layer !== frame.layer || next.sampleRateHz !== frame.sampleRateHz) continue;
    }
    const frameOffset = id3Size + index;
    const frameBytes = readAt(handle, fileSize, frameOffset, Math.min(frame.length, 4_096));
    const variable = readMp3VariableHeader(frameBytes, frame);
    return {
      bitrateKbps: variable.bitrateKbps === undefined ? frame.bitrateKbps : variable.bitrateKbps,
      channels: frame.channels,
      durationMs: variable.durationMs,
      format: 'MP3',
      sampleRateHz: frame.sampleRateHz,
    };
  }
  return { ...EMPTY_METADATA, format: 'MP3' };
}

interface MpegFrame {
  bitrateKbps: number;
  channels: number;
  crcBytes: number;
  layer: 1 | 2 | 3;
  length: number;
  sampleRateHz: number;
  samplesPerFrame: number;
  version: 1 | 2 | 2.5;
}

function readMpegFrame(bytes: Uint8Array, offset: number): MpegFrame | null {
  if (!isMpegAudioHeader(bytes, offset)) return null;
  const second = bytes[offset + 1];
  const third = bytes[offset + 2];
  const fourth = bytes[offset + 3];
  const versionBits = (second >> 3) & 0x03;
  const layerBits = (second >> 1) & 0x03;
  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
  const layer = (4 - layerBits) as 1 | 2 | 3;
  const bitrateIndex = (third >> 4) & 0x0f;
  const sampleRateIndex = (third >> 2) & 0x03;
  const bitrateKbps = mpegBitrate(version, layer, bitrateIndex);
  const baseSampleRate = [44_100, 48_000, 32_000][sampleRateIndex] ?? 0;
  const sampleRateHz = version === 1 ? baseSampleRate : version === 2 ? baseSampleRate / 2 : baseSampleRate / 4;
  if (!bitrateKbps || !sampleRateHz) return null;
  const padding = (third >> 1) & 0x01;
  const length = layer === 1
    ? Math.floor((12 * bitrateKbps * 1_000 / sampleRateHz + padding) * 4)
    : Math.floor(((layer === 3 && version !== 1 ? 72 : 144) * bitrateKbps * 1_000 / sampleRateHz) + padding);
  if (length < 4) return null;
  return {
    bitrateKbps,
    channels: ((fourth >> 6) & 0x03) === 3 ? 1 : 2,
    crcBytes: (second & 0x01) === 0 ? 2 : 0,
    layer,
    length,
    sampleRateHz,
    samplesPerFrame: layer === 1 ? 384 : layer === 3 && version !== 1 ? 576 : 1_152,
    version,
  };
}

function readMp3VariableHeader(bytes: Uint8Array, frame: MpegFrame): { bitrateKbps: number | null | undefined; durationMs: number | null } {
  const sideInfoBytes = frame.layer === 3
    ? frame.version === 1 ? frame.channels === 1 ? 17 : 32 : frame.channels === 1 ? 9 : 17
    : 0;
  const xingOffset = 4 + frame.crcBytes + sideInfoBytes;
  if (isAscii(bytes, xingOffset, 'Xing') || isAscii(bytes, xingOffset, 'Info')) {
    const variableBitrate = isAscii(bytes, xingOffset, 'Xing');
    const flags = readUInt32BE(bytes, xingOffset + 4);
    let cursor = xingOffset + 8;
    const frameCount = (flags & 0x01) !== 0 ? readUInt32BE(bytes, cursor) : 0;
    if ((flags & 0x01) !== 0) cursor += 4;
    const audioBytes = (flags & 0x02) !== 0 ? readUInt32BE(bytes, cursor) : 0;
    const values = variableMp3Values(frame, frameCount, audioBytes);
    return { ...values, bitrateKbps: values.bitrateKbps ?? (variableBitrate ? null : undefined) };
  }
  for (let offset = 4; offset + 18 <= Math.min(bytes.length, 160); offset += 1) {
    if (!isAscii(bytes, offset, 'VBRI')) continue;
    return variableMp3Values(frame, readUInt32BE(bytes, offset + 14), readUInt32BE(bytes, offset + 10));
  }
  return { bitrateKbps: undefined, durationMs: null };
}

function variableMp3Values(frame: MpegFrame, frameCount: number, audioBytes: number): { bitrateKbps: number | null; durationMs: number | null } {
  if (!frameCount) return { bitrateKbps: null, durationMs: null };
  const durationSeconds = frameCount * frame.samplesPerFrame / frame.sampleRateHz;
  return {
    bitrateKbps: audioBytes > 0 && durationSeconds > 0 ? Math.round(audioBytes * 8 / durationSeconds / 1_000) : null,
    durationMs: durationSeconds > 0 ? Math.round(durationSeconds * 1_000) : null,
  };
}

function mpegBitrate(version: MpegFrame['version'], layer: MpegFrame['layer'], index: number): number {
  if (index <= 0 || index >= 15) return 0;
  if (version === 1) {
    if (layer === 1) return [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448][index];
    if (layer === 2) return [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384][index];
    return [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320][index];
  }
  if (layer === 1) return [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256][index];
  return [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160][index];
}

function parseAac(handle: FileHandle, fileSize: number): ParsedAudioMetadata {
  const scan = readAt(handle, fileSize, 0, Math.min(64 * 1_024, fileSize));
  for (let offset = 0; offset + 7 <= scan.length; offset += 1) {
    if (!isAdtsHeader(scan, offset)) continue;
    const sampleRateIndex = (scan[offset + 2] >> 2) & 0x0f;
    const sampleRateHz = [96_000, 88_200, 64_000, 48_000, 44_100, 32_000, 24_000, 22_050, 16_000, 12_000, 11_025, 8_000, 7_350][sampleRateIndex] ?? 0;
    const channels = ((scan[offset + 2] & 0x01) << 2) | ((scan[offset + 3] & 0xc0) >> 6);
    return { bitrateKbps: null, channels: channels || null, durationMs: null, format: 'AAC', sampleRateHz: sampleRateHz || null };
  }
  return { ...EMPTY_METADATA, format: 'AAC' };
}

function parseOgg(handle: FileHandle, fileSize: number): ParsedAudioMetadata {
  const prefix = readAt(handle, fileSize, 0, Math.min(256 * 1_024, fileSize));
  const vorbisOffset = findAscii(prefix, '\x01vorbis');
  const opusOffset = findAscii(prefix, 'OpusHead');
  if (vorbisOffset >= 0 && vorbisOffset + 28 <= prefix.length) {
    const channels = prefix[vorbisOffset + 11] || null;
    const sampleRateHz = readUInt32LE(prefix, vorbisOffset + 12) || null;
    const nominalBitrate = readInt32LE(prefix, vorbisOffset + 20);
    const granule = readLastOggGranule(handle, fileSize);
    return {
      bitrateKbps: nominalBitrate > 0 ? Math.round(nominalBitrate / 1_000) : null,
      channels,
      durationMs: sampleRateHz && granule !== null ? Math.round(granule / sampleRateHz * 1_000) : null,
      format: 'OGG',
      sampleRateHz,
    };
  }
  if (opusOffset >= 0 && opusOffset + 19 <= prefix.length) {
    const preSkip = readUInt16LE(prefix, opusOffset + 10);
    const granule = readLastOggGranule(handle, fileSize);
    return {
      bitrateKbps: null,
      channels: prefix[opusOffset + 9] || null,
      durationMs: granule !== null && granule > preSkip ? Math.round((granule - preSkip) / 48_000 * 1_000) : null,
      format: 'OGG',
      sampleRateHz: 48_000,
    };
  }
  return { ...EMPTY_METADATA, format: 'OGG' };
}

function readLastOggGranule(handle: FileHandle, fileSize: number): number | null {
  const tailSize = Math.min(256 * 1_024, fileSize);
  const tail = readAt(handle, fileSize, fileSize - tailSize, tailSize);
  for (let offset = tail.length - 27; offset >= 0; offset -= 1) {
    if (!isAscii(tail, offset, 'OggS') || offset + 27 > tail.length) continue;
    const segmentCount = tail[offset + 26];
    if (offset + 27 + segmentCount > tail.length) continue;
    let payloadLength = 0;
    for (let index = 0; index < segmentCount; index += 1) payloadLength += tail[offset + 27 + index];
    if (offset + 27 + segmentCount + payloadLength > tail.length) continue;
    const low = readUInt32LE(tail, offset + 6);
    const high = readUInt32LE(tail, offset + 10);
    if (low === 0xffff_ffff && high === 0xffff_ffff) continue;
    return high * 0x1_0000_0000 + low;
  }
  return null;
}

interface IsoBox {
  contentStart: number;
  end: number;
  type: string;
}

function parseM4a(handle: FileHandle, fileSize: number): ParsedAudioMetadata {
  const moov = findIsoBoxes(handle, fileSize, 0, fileSize, 'moov')[0];
  if (!moov) return { ...EMPTY_METADATA, format: 'M4A' };
  const tracks = findIsoBoxes(handle, fileSize, moov.contentStart, moov.end, 'trak');
  for (const track of tracks) {
    const mdia = findIsoBoxes(handle, fileSize, track.contentStart, track.end, 'mdia')[0];
    if (!mdia) continue;
    const handler = findIsoBoxes(handle, fileSize, mdia.contentStart, mdia.end, 'hdlr')[0];
    if (!handler || ascii(readAt(handle, fileSize, handler.contentStart + 8, 4), 0, 4) !== 'soun') continue;
    const mdhd = findIsoBoxes(handle, fileSize, mdia.contentStart, mdia.end, 'mdhd')[0];
    const timing = mdhd ? readM4aTiming(handle, fileSize, mdhd) : { durationMs: null, timescale: null };
    const minf = findIsoBoxes(handle, fileSize, mdia.contentStart, mdia.end, 'minf')[0];
    const stbl = minf ? findIsoBoxes(handle, fileSize, minf.contentStart, minf.end, 'stbl')[0] : null;
    const stsd = stbl ? findIsoBoxes(handle, fileSize, stbl.contentStart, stbl.end, 'stsd')[0] : null;
    const audio = stsd ? readM4aAudioSampleEntry(handle, fileSize, stsd) : null;
    return {
      bitrateKbps: null,
      channels: audio?.channels ?? null,
      durationMs: timing.durationMs,
      format: 'M4A',
      sampleRateHz: audio?.sampleRateHz ?? null,
    };
  }
  return { ...EMPTY_METADATA, format: 'M4A' };
}

function readM4aTiming(handle: FileHandle, fileSize: number, box: IsoBox): { durationMs: number | null; timescale: number | null } {
  const data = readAt(handle, fileSize, box.contentStart, Math.min(36, box.end - box.contentStart));
  if (data.length < 20) return { durationMs: null, timescale: null };
  const version = data[0];
  const timescaleOffset = version === 1 ? 20 : 12;
  const durationOffset = version === 1 ? 24 : 16;
  if (data.length < durationOffset + (version === 1 ? 8 : 4)) return { durationMs: null, timescale: null };
  const timescale = readUInt32BE(data, timescaleOffset) || null;
  const duration = version === 1 ? readUInt64BE(data, durationOffset) : readUInt32BE(data, durationOffset);
  const unknownDuration = version === 1
    ? data.slice(durationOffset, durationOffset + 8).every((byte) => byte === 0xff)
    : duration === 0xffff_ffff;
  return { durationMs: timescale && duration > 0 && !unknownDuration ? Math.round(duration / timescale * 1_000) : null, timescale };
}

function readM4aAudioSampleEntry(handle: FileHandle, fileSize: number, stsd: IsoBox): { channels: number | null; sampleRateHz: number | null } | null {
  const entryStart = stsd.contentStart + 8;
  const entries = findIsoBoxes(handle, fileSize, entryStart, stsd.end);
  const entry = entries.find((item) => item.type === 'mp4a' || item.type === 'alac');
  if (!entry) return null;
  const data = readAt(handle, fileSize, entry.contentStart, Math.min(28, entry.end - entry.contentStart));
  if (data.length < 28) return null;
  return {
    channels: readUInt16BE(data, 16) || null,
    sampleRateHz: (readUInt32BE(data, 24) >>> 16) || null,
  };
}

function findIsoBoxes(handle: FileHandle, fileSize: number, start: number, end: number, wantedType?: string): IsoBox[] {
  const boxes: IsoBox[] = [];
  let offset = start;
  for (let boxIndex = 0; boxIndex < 10_000 && offset + 8 <= end; boxIndex += 1) {
    const header = readAt(handle, fileSize, offset, 16);
    if (header.length < 8) break;
    const size32 = readUInt32BE(header, 0);
    const type = ascii(header, 4, 4);
    const headerSize = size32 === 1 ? 16 : 8;
    const size = size32 === 0 ? end - offset : size32 === 1 ? readUInt64BE(header, 8) : size32;
    if (size < headerSize || offset + size > end) break;
    const box = { contentStart: offset + headerSize, end: offset + size, type };
    if (!wantedType || type === wantedType) boxes.push(box);
    offset += size;
  }
  return boxes;
}

function isMpegAudioHeader(bytes: Uint8Array, offset: number): boolean {
  if (offset < 0 || offset + 4 > bytes.length) return false;
  const versionBits = (bytes[offset + 1] >> 3) & 0x03;
  const layerBits = (bytes[offset + 1] >> 1) & 0x03;
  const bitrateIndex = (bytes[offset + 2] >> 4) & 0x0f;
  const sampleRateIndex = (bytes[offset + 2] >> 2) & 0x03;
  return bytes[offset] === 0xff && (bytes[offset + 1] & 0xe0) === 0xe0
    && versionBits !== 1 && layerBits !== 0 && bitrateIndex !== 0 && bitrateIndex !== 15 && sampleRateIndex !== 3;
}

function isAdtsHeader(bytes: Uint8Array, offset: number): boolean {
  return offset >= 0 && offset + 7 <= bytes.length && bytes[offset] === 0xff
    && (bytes[offset + 1] & 0xf6) === 0xf0;
}

function readAt(handle: FileHandle, fileSize: number, offset: number, length: number): Uint8Array {
  if (!Number.isFinite(offset) || !Number.isFinite(length) || offset < 0 || length <= 0 || offset >= fileSize) return new Uint8Array();
  handle.offset = Math.floor(offset);
  return handle.readBytes(Math.min(Math.floor(length), fileSize - Math.floor(offset)));
}

function findAscii(bytes: Uint8Array, value: string): number {
  for (let offset = 0; offset + value.length <= bytes.length; offset += 1) {
    if (isAscii(bytes, offset, value)) return offset;
  }
  return -1;
}

function isAscii(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset < 0 || offset + value.length > bytes.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || offset + length > bytes.length) return '';
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.length) return 0;
  return bytes[offset] * 0x100 + bytes[offset + 1];
}

function readUInt16LE(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.length) return 0;
  return bytes[offset] + bytes[offset + 1] * 0x100;
}

function readUInt24BE(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 3 > bytes.length) return 0;
  return bytes[offset] * 0x1_0000 + bytes[offset + 1] * 0x100 + bytes[offset + 2];
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) return 0;
  return bytes[offset] * 0x1_0000_00 + bytes[offset + 1] * 0x1_0000 + bytes[offset + 2] * 0x100 + bytes[offset + 3];
}

function readUInt32LE(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) return 0;
  return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x1_0000 + bytes[offset + 3] * 0x1_0000_00;
}

function readInt32LE(bytes: Uint8Array, offset: number): number {
  const value = readUInt32LE(bytes, offset);
  return value > 0x7fff_ffff ? value - 0x1_0000_0000 : value;
}

function readUInt64BE(bytes: Uint8Array, offset: number): number {
  return readUInt32BE(bytes, offset) * 0x1_0000_0000 + readUInt32BE(bytes, offset + 4);
}

function readSyncSafe(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) return 0;
  return ((bytes[offset] & 0x7f) << 21) | ((bytes[offset + 1] & 0x7f) << 14) | ((bytes[offset + 2] & 0x7f) << 7) | (bytes[offset + 3] & 0x7f);
}
