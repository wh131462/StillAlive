import type { DayKey } from '@still-alive/types';

export function toDayKey(date: Date): DayKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as DayKey;
}

export function mediaReference(id: string, alt = ''): string {
  return `![${alt}](media://${id})`;
}
