export interface AudioEmbed {
  durationMs: number;
  id: string;
}

const AUDIO_EMBED_PATTERN = /!\[语音\]\(audio:\/\/([^)?]+)(?:\?duration=(\d+))?\)/g;
const IMAGE_EMBED_PATTERN = /!\[[^\]]*\]\(media:\/\/([^)]+)\)/g;

export function createAudioEmbed(id: string, durationMs: number): string {
  return `![语音](audio://${id}?duration=${Math.max(0, Math.round(durationMs))})`;
}

export function extractAudioEmbeds(markdown: string): AudioEmbed[] {
  return [...markdown.matchAll(AUDIO_EMBED_PATTERN)].map((match) => ({
    durationMs: Number(match[2] ?? 0),
    id: match[1],
  }));
}

export function extractImageMediaIds(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(IMAGE_EMBED_PATTERN)].map((match) => match[1]))];
}

export function extractEmbeddedMediaIds(markdown: string): string[] {
  return [...new Set([...extractImageMediaIds(markdown), ...extractAudioEmbeds(markdown).map((item) => item.id)])];
}

export function withoutEmbeddedAttachments(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\((?:media|audio):\/\/[^)]+\)/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function formatAudioDuration(durationMs: number | null): string {
  const totalSeconds = Math.max(0, Math.round((durationMs ?? 0) / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
