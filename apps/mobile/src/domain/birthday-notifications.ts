import type { BirthdayCalendar, BirthdayNotificationSchedule, Person } from '@still-alive/types';
import { nextBirthday, toLocalDayKey } from './person-profile';

export interface PlannedBirthdayNotification {
  key: string;
  personId: string;
  personName: string;
  calendar: BirthdayCalendar;
  eventType: 'advance' | 'today';
  birthdayDayKey: ReturnType<typeof toLocalDayKey>;
  triggerAt: Date;
}

export interface BirthdayNotificationAdapter {
  getPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  requestPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  schedule(item: PlannedBirthdayNotification): Promise<string>;
  cancel(platformIdentifier: string): Promise<void>;
}

export interface BirthdayScheduleStore {
  listBirthdayNotificationSchedules(): Promise<BirthdayNotificationSchedule[]>;
  replaceBirthdayNotificationSchedules(items: BirthdayNotificationSchedule[]): Promise<void>;
}

export function planBirthdayNotifications(people: Person[], hour: number, minute: number, now = new Date()): PlannedBirthdayNotification[] {
  const horizon = new Date(now);
  horizon.setFullYear(horizon.getFullYear() + 1);
  const result = new Map<string, PlannedBirthdayNotification>();
  for (const person of people) {
    if (!person.birthday) continue;
    const birthday = nextBirthday(person.birthday, now);
    const todayTrigger = atTime(birthday, hour, minute);
    const advanceTrigger = new Date(todayTrigger);
    advanceTrigger.setDate(advanceTrigger.getDate() - 3);
    const dayKey = toLocalDayKey(birthday);
    if (advanceTrigger.getTime() > now.getTime() && advanceTrigger.getTime() <= horizon.getTime()) {
      const item = planned(person, person.birthday.calendar, 'advance', dayKey, advanceTrigger);
      result.set(item.key, item);
    }
    if (todayTrigger.getTime() > now.getTime() && todayTrigger.getTime() <= horizon.getTime()) {
      const item = planned(person, person.birthday.calendar, 'today', dayKey, todayTrigger);
      result.set(item.key, item);
    }
  }
  return [...result.values()].sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());
}

export async function reconcileBirthdayNotifications(store: BirthdayScheduleStore, adapter: BirthdayNotificationAdapter, people: Person[], enabled: boolean, hour: number, minute: number, requestPermission = false): Promise<void> {
  const existing = await store.listBirthdayNotificationSchedules();
  if (!enabled) {
    for (const item of existing) await adapter.cancel(item.platformIdentifier);
    await store.replaceBirthdayNotificationSchedules([]);
    return;
  }
  let permission = await adapter.getPermission();
  if (permission === 'undetermined' && requestPermission) permission = await adapter.requestPermission();
  if (permission !== 'granted') throw new Error('系统通知权限未开启');
  const plannedItems = planBirthdayNotifications(people, hour, minute);
  const plannedKeys = new Set(plannedItems.map((item) => item.key));
  const retained = existing.filter((item) => plannedKeys.has(scheduleKey(item.personId, item.eventType, item.birthdayDayKey, new Date(item.scheduledAt))));
  const retainedKeys = new Set(retained.map((item) => scheduleKey(item.personId, item.eventType, item.birthdayDayKey, new Date(item.scheduledAt))));
  for (const item of existing) if (!retained.includes(item)) await adapter.cancel(item.platformIdentifier);
  const created: BirthdayNotificationSchedule[] = [];
  try {
    for (const item of plannedItems) {
      if (retainedKeys.has(item.key)) continue;
      const platformIdentifier = await adapter.schedule(item);
      created.push({ id: `birthday_notification_${Date.now()}_${created.length}`, personId: item.personId, eventType: item.eventType, birthdayDayKey: item.birthdayDayKey, scheduledAt: item.triggerAt.toISOString(), platformIdentifier });
    }
    await store.replaceBirthdayNotificationSchedules([...retained, ...created]);
  } catch (cause) {
    for (const item of created) await adapter.cancel(item.platformIdentifier).catch(() => undefined);
    throw cause;
  }
}

export async function cancelBirthdayNotifications(store: BirthdayScheduleStore, adapter: BirthdayNotificationAdapter, personId?: string): Promise<void> {
  const existing = await store.listBirthdayNotificationSchedules();
  const canceled = personId ? existing.filter((item) => item.personId === personId) : existing;
  if (canceled.length === 0) return;
  for (const item of canceled) await adapter.cancel(item.platformIdentifier);
  await store.replaceBirthdayNotificationSchedules(personId ? existing.filter((item) => item.personId !== personId) : []);
}

function planned(person: Person, calendar: BirthdayCalendar, eventType: 'advance' | 'today', birthdayDayKey: ReturnType<typeof toLocalDayKey>, triggerAt: Date): PlannedBirthdayNotification {
  return { key: scheduleKey(person.id, eventType, birthdayDayKey, triggerAt), personId: person.id, personName: person.name, calendar, eventType, birthdayDayKey, triggerAt };
}

function scheduleKey(personId: string, eventType: string, birthdayDayKey: string, triggerAt: Date): string {
  return `${personId}:${eventType}:${birthdayDayKey}:${triggerAt.getHours()}:${triggerAt.getMinutes()}`;
}

function atTime(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}
