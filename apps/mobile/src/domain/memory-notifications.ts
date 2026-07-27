import type { Post } from '@still-alive/types';

export const MEMORY_NOTIFICATION_BATCH_SIZE = 3;
export const MEMORY_NOTIFICATION_HOUR = 20;
const BASE_STABILITY_DAYS = 30;
const STABILITY_GROWTH = 2.2;
const TARGET_RETENTION = 0.35;
const MINIMUM_GAP_DAYS = 7;

export interface MemoryNotificationSchedule {
  id: string;
  postId: string;
  scheduledAt: string;
  platformIdentifier: string;
}

export interface MemoryNotificationExposure {
  postId: string;
  lastShownAt: string;
  reviewCount: number;
}

export interface PlannedMemoryNotification {
  post: Post;
  triggerAt: Date;
  onThisDay: boolean;
}

export interface MemoryNotificationAdapter {
  getPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  requestPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  schedule(item: PlannedMemoryNotification): Promise<string>;
  cancel(platformIdentifier: string): Promise<void>;
}

export interface MemoryNotificationScheduleStore {
  listMemoryNotificationSchedules(): Promise<MemoryNotificationSchedule[]>;
  replaceMemoryNotificationSchedules(items: MemoryNotificationSchedule[]): Promise<void>;
  listMemoryNotificationExposures(): Promise<MemoryNotificationExposure[]>;
  recordMemoryNotificationExposure(postId: string, shownAt: string): Promise<void>;
}

export function planMemoryNotifications(posts: Post[], exposures: MemoryNotificationExposure[], existing: MemoryNotificationSchedule[], now = new Date()): PlannedMemoryNotification[] {
  const exposureByPost = new Map(exposures.map((item) => [item.postId, item]));
  const scheduledPostIds = new Set(existing.map((item) => item.postId));
  const candidates = posts
    .filter((post) => !scheduledPostIds.has(post.id))
    .map((post) => ({ post, dueAt: memoryDueAt(post, exposureByPost.get(post.id)) }))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.post.id.localeCompare(b.post.id));

  const planned: PlannedMemoryNotification[] = [];
  let previousTrigger = existing.length
    ? new Date([...existing].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0].scheduledAt)
    : null;
  for (const candidate of candidates) {
    if (planned.length >= MEMORY_NOTIFICATION_BATCH_SIZE - existing.length) break;
    const triggerAt = atNotificationTime(candidate.dueAt, now);
    if (previousTrigger) {
      const earliestAfterPrevious = new Date(previousTrigger);
      earliestAfterPrevious.setDate(earliestAfterPrevious.getDate() + MINIMUM_GAP_DAYS);
      if (triggerAt.getTime() < earliestAfterPrevious.getTime()) triggerAt.setTime(earliestAfterPrevious.getTime());
    }
    planned.push({ post: candidate.post, triggerAt, onThisDay: sameMonthAndDay(candidate.post.dayKey, triggerAt) });
    previousTrigger = triggerAt;
  }
  return planned;
}

export async function reconcileMemoryNotifications(store: MemoryNotificationScheduleStore, adapter: MemoryNotificationAdapter, posts: Post[], enabled: boolean, requestPermission = false, now = new Date()): Promise<void> {
  const existing = await store.listMemoryNotificationSchedules();
  const postIds = new Set(posts.map((post) => post.id));
  const delivered = existing.filter((item) => postIds.has(item.postId) && new Date(item.scheduledAt).getTime() <= now.getTime());
  for (const item of delivered) await store.recordMemoryNotificationExposure(item.postId, item.scheduledAt);

  if (!enabled) {
    for (const item of existing) if (!delivered.includes(item)) await adapter.cancel(item.platformIdentifier);
    await store.replaceMemoryNotificationSchedules([]);
    return;
  }

  let permission = await adapter.getPermission();
  if (permission === 'undetermined' && requestPermission) permission = await adapter.requestPermission();
  if (permission !== 'granted') throw new Error('系统通知权限未开启');

  const retained = existing.filter((item) => postIds.has(item.postId) && new Date(item.scheduledAt).getTime() > now.getTime());
  for (const item of existing) if (!delivered.includes(item) && !retained.includes(item)) await adapter.cancel(item.platformIdentifier);

  const planned = planMemoryNotifications(posts, await store.listMemoryNotificationExposures(), retained, now);
  const created: MemoryNotificationSchedule[] = [];
  try {
    for (const item of planned) {
      const platformIdentifier = await adapter.schedule(item);
      created.push({ id: `memory_notification_${Date.now()}_${created.length}`, postId: item.post.id, scheduledAt: item.triggerAt.toISOString(), platformIdentifier });
    }
    await store.replaceMemoryNotificationSchedules([...retained, ...created]);
  } catch (cause) {
    for (const item of created) await adapter.cancel(item.platformIdentifier).catch(() => undefined);
    throw cause;
  }
}

export async function cancelMemoryNotifications(store: MemoryNotificationScheduleStore, adapter: MemoryNotificationAdapter, postId?: string): Promise<void> {
  const existing = await store.listMemoryNotificationSchedules();
  const canceled = postId ? existing.filter((item) => item.postId === postId) : existing;
  for (const item of canceled) await adapter.cancel(item.platformIdentifier);
  if (canceled.length) await store.replaceMemoryNotificationSchedules(postId ? existing.filter((item) => item.postId !== postId) : []);
}

export function memoryRetention(elapsedDays: number, reviewCount: number): number {
  const stability = BASE_STABILITY_DAYS * Math.pow(STABILITY_GROWTH, Math.min(reviewCount, 6));
  return Math.exp(-Math.max(0, elapsedDays) / stability);
}

function memoryDueAt(post: Post, exposure: MemoryNotificationExposure | undefined): Date {
  const origin = exposure ? new Date(exposure.lastShownAt) : new Date(`${post.dayKey}T${MEMORY_NOTIFICATION_HOUR}:00:00`);
  const reviewCount = exposure?.reviewCount ?? 0;
  const stability = BASE_STABILITY_DAYS * Math.pow(STABILITY_GROWTH, Math.min(reviewCount, 6));
  const elapsedDaysAtThreshold = -Math.log(TARGET_RETENTION) * stability;
  return new Date(origin.getTime() + elapsedDaysAtThreshold * 24 * 60 * 60 * 1000);
}

function atNotificationTime(dueAt: Date, now: Date): Date {
  const triggerAt = new Date(dueAt);
  triggerAt.setHours(MEMORY_NOTIFICATION_HOUR, 0, 0, 0);
  if (triggerAt.getTime() <= now.getTime()) {
    triggerAt.setTime(now.getTime());
    triggerAt.setDate(triggerAt.getDate() + 1);
    triggerAt.setHours(MEMORY_NOTIFICATION_HOUR, 0, 0, 0);
  }
  return triggerAt;
}

function sameMonthAndDay(dayKey: string, date: Date): boolean {
  return dayKey.slice(5) === `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
