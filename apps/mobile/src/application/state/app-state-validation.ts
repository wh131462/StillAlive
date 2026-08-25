import { extractVisualMediaIds } from '../../features/journal/embedded-media';

export function validatePost(bodyMarkdown: string, personIds: string[], locationName: string | null): void {
  if (!bodyMarkdown.trim()) throw new Error('正文、图片或语音至少需要保留一项');
  if (extractVisualMediaIds(bodyMarkdown).length > 9) throw new Error('一条记录最多包含 9 张图片或视频');
  if (new Set(personIds).size > 10) throw new Error('一条记录最多关联 10 个人物');
  if (locationName && locationName.length > 80) throw new Error('地点名称不能超过 80 字');
}

export function normalizeTagName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 24) throw new Error('标签文字需为 1—24 字');
  return trimmed.toLocaleLowerCase();
}
