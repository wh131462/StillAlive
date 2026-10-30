import type { BirthdayCalendar, BirthdayNotificationSchedule, Person, PersonImportantDate } from '@still-alive/types';
import { nextBirthday, personDisplayName, toLocalDayKey } from './person-profile';

export type ReminderEventType = 'advance' | 'today' | 'important-date';

export interface PlannedBirthdayNotification {
  key: string;
  personId: string;
  personName: string;
  calendar: BirthdayCalendar;
  eventType: ReminderEventType;
  birthdayDayKey: ReturnType<typeof toLocalDayKey>;
  importantDateId: string | null;
  importantDateName: string | null;
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
    if (person.birthday && person.birthday.reminderEnabled) {
      const reminderHour = person.birthday.reminderHour ?? hour;
      const reminderMinute = person.birthday.reminderMinute ?? minute;
      const birthday = nextBirthday(person.birthday, now);
      const todayTrigger = atTime(birthday, reminderHour, reminderMinute);
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
    for (const importantDate of person.importantDates) {
      if (!importantDate.reminderEnabled) continue;
      const occurrence = nextImportantDateOccurrence(importantDate.date, now);
      if (!occurrence) continue;
      const triggerAt = atTime(occurrence, hour, minute);
      if (triggerAt.getTime() <= now.getTime() || triggerAt.getTime() > horizon.getTime()) continue;
      const item = plannedImportantDate(person, importantDate, triggerAt);
      result.set(item.key, item);
    }
  }
  return [...result.values()].sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());
}

export async function reconcileBirthdayNotifications(store: BirthdayScheduleStore, adapter: BirthdayNotificationAdapter, people: Person[], enabled: boolean, hour: number, minute: number, requestPermission = false): Promise<void> {
  const existing = await store.listBirthdayNotificationSchedules();
  if (!enabled) {
    if (existing.length === 0) return;
    for (const item of existing) await adapter.cancel(item.platformIdentifier);
    await store.replaceBirthdayNotificationSchedules([]);
    return;
  }
  let permission = await adapter.getPermission();
  if (permission === 'undetermined' && requestPermission) permission = await adapter.requestPermission();
  if (permission !== 'granted') throw new Error('系统通知权限未开启');
  const plannedItems = planBirthdayNotifications(people, hour, minute);
  const plannedKeys = new Set(plannedItems.map((item) => item.key));
  const retained = existing.filter((item) => plannedKeys.has(scheduleKeyOf(item)));
  const retainedKeys = new Set(retained.map(scheduleKeyOf));
  for (const item of existing) if (!retained.includes(item)) await adapter.cancel(item.platformIdentifier);
  const created: BirthdayNotificationSchedule[] = [];
  try {
    for (const item of plannedItems) {
      if (retainedKeys.has(item.key)) continue;
      const platformIdentifier = await adapter.schedule(item);
      created.push({ id: `birthday_notification_${Date.now()}_${created.length}`, personId: item.personId, eventType: item.eventType, birthdayDayKey: item.birthdayDayKey, importantDateId: item.importantDateId, scheduledAt: item.triggerAt.toISOString(), platformIdentifier });
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
  return { key: scheduleKey(person.id, eventType, birthdayDayKey, triggerAt, null), personId: person.id, personName: personDisplayName(person), calendar, eventType, birthdayDayKey, importantDateId: null, importantDateName: null, triggerAt };
}

function plannedImportantDate(person: Person, importantDate: PersonImportantDate, triggerAt: Date): PlannedBirthdayNotification {
  const dayKey = toLocalDayKey(triggerAt);
  return {
    key: scheduleKey(person.id, 'important-date', dayKey, triggerAt, importantDate.id),
    personId: person.id,
    personName: personDisplayName(person),
    calendar: person.birthday?.calendar ?? 'solar',
    eventType: 'important-date',
    birthdayDayKey: dayKey,
    importantDateId: importantDate.id,
    importantDateName: importantDate.name,
    triggerAt,
  };
}

function scheduleKeyOf(item: BirthdayNotificationSchedule): string {
  return scheduleKey(item.personId, item.eventType, item.birthdayDayKey, new Date(item.scheduledAt), item.importantDateId);
}

function scheduleKey(personId: string, eventType: string, birthdayDayKey: string, triggerAt: Date, importantDateId: string | null): string {
  return `${personId}:${eventType}:${birthdayDayKey}:${triggerAt.getHours()}:${triggerAt.getMinutes()}${importantDateId ? `:${importantDateId}` : ''}`;
}

function nextImportantDateOccurrence(value: string, now: Date): Date | null {
  const segments = value.split('-');
  const month = Number(segments[segments.length - 2]);
  const day = Number(segments[segments.length - 1]);
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const current = annualDate(today.getFullYear(), month, day);
  return current.getTime() >= today.getTime() ? current : annualDate(today.getFullYear() + 1, month, day);
}

function annualDate(year: number, month: number, day: number): Date {
  const leapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return new Date(year, month - 1, month === 2 && day === 29 && !leapYear ? 28 : day);
}

function atTime(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}
