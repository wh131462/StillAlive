import { LunarDay, LunarMonth, LunarYear, SolarDay } from 'tyme4ts';
import type { Birthday, BirthdayCalendar, DayKey } from '@still-alive/types';

export const MBTI_TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'] as const;

export function validateBirthday(birthday: Birthday, today = new Date()): void {
  if (!Number.isInteger(birthday.year) || birthday.year < 1900 || birthday.year > today.getFullYear()) throw new Error('生日年份无效');
  try {
    if (birthday.calendar === 'solar') {
      if (birthday.isLeapMonth) throw new Error('公历生日不能设置闰月');
      const day = SolarDay.fromYmd(birthday.year, birthday.month, birthday.day);
      if (localDate(day.getYear(), day.getMonth(), day.getDay()).getTime() > startOfDay(today).getTime()) throw new Error('生日不能晚于今天');
      return;
    }
    const leapMonth = LunarYear.fromYear(birthday.year).getLeapMonth();
    if (birthday.isLeapMonth && leapMonth !== birthday.month) throw new Error('该农历年份没有这个闰月');
    const lunar = LunarDay.fromYmd(birthday.year, birthday.isLeapMonth ? -birthday.month : birthday.month, birthday.day);
    const solar = lunar.getSolarDay();
    if (localDate(solar.getYear(), solar.getMonth(), solar.getDay()).getTime() > startOfDay(today).getTime()) throw new Error('生日不能晚于今天');
  } catch (cause) {
    if (cause instanceof Error && (cause.message.includes('生日') || cause.message.includes('闰月'))) throw cause;
    throw new Error('生日日期不存在');
  }
}

export function birthdayFromDateString(value: string, calendar: BirthdayCalendar, isLeapMonth: boolean): Birthday | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const birthday: Birthday = { calendar, day, isLeapMonth: calendar === 'lunar' && isLeapMonth, month, reminderMode: calendar, year };
  try {
    validateBirthday(birthday);
    return birthday;
  } catch {
    return null;
  }
}

export function birthdaySolarDate(birthday: Birthday): Date {
  validateBirthday(birthday, new Date(9999, 11, 31));
  if (birthday.calendar === 'solar') return localDate(birthday.year, birthday.month, birthday.day);
  const day = LunarDay.fromYmd(birthday.year, birthday.isLeapMonth ? -birthday.month : birthday.month, birthday.day).getSolarDay();
  return localDate(day.getYear(), day.getMonth(), day.getDay());
}

export function birthdayInSolarYear(birthday: Birthday, solarYear: number): Date {
  if (birthday.calendar === 'solar') {
    const day = birthday.month === 2 && birthday.day === 29 && !isSolarLeapYear(solarYear) ? 28 : birthday.day;
    return localDate(solarYear, birthday.month, day);
  }
  for (let lunarYear = solarYear - 1; lunarYear <= solarYear + 1; lunarYear += 1) {
    const leapMonth = LunarYear.fromYear(lunarYear).getLeapMonth();
    const signedMonth = birthday.isLeapMonth && leapMonth === birthday.month ? -birthday.month : birthday.month;
    const month = LunarMonth.fromYm(lunarYear, signedMonth);
    const day = LunarDay.fromYmd(lunarYear, signedMonth, Math.min(birthday.day, month.getDayCount())).getSolarDay();
    if (day.getYear() === solarYear) return localDate(day.getYear(), day.getMonth(), day.getDay());
  }
  throw new Error('无法计算该年的农历生日');
}

export function nextBirthday(birthday: Birthday, now = new Date()): Date {
  const today = startOfDay(now);
  const current = birthdayInSolarYear(birthday, today.getFullYear());
  return current.getTime() >= today.getTime() ? current : birthdayInSolarYear(birthday, today.getFullYear() + 1);
}

export function birthdayForCalendar(birthday: Birthday, calendar: BirthdayCalendar): Birthday {
  if (birthday.calendar === calendar) return birthday;
  const solarDate = birthdaySolarDate(birthday);
  if (calendar === 'solar') {
    return {
      calendar,
      year: solarDate.getFullYear(),
      month: solarDate.getMonth() + 1,
      day: solarDate.getDate(),
      isLeapMonth: false,
      reminderMode: birthday.reminderMode,
    };
  }
  const lunar = SolarDay.fromYmd(solarDate.getFullYear(), solarDate.getMonth() + 1, solarDate.getDate()).getLunarDay();
  const monthWithLeap = lunar.getLunarMonth().getMonthWithLeap();
  return {
    calendar,
    year: lunar.getYear(),
    month: Math.abs(monthWithLeap),
    day: lunar.getDay(),
    isLeapMonth: monthWithLeap < 0,
    reminderMode: birthday.reminderMode,
  };
}

export function constellationForBirthday(birthday: Birthday): string {
  const solar = birthdaySolarDate(birthday);
  return SolarDay.fromYmd(solar.getFullYear(), solar.getMonth() + 1, solar.getDate()).getConstellation().toString();
}

export function zodiacForBirthday(birthday: Birthday): string {
  if (birthday.calendar === 'lunar') return LunarDay.fromYmd(birthday.year, birthday.isLeapMonth ? -birthday.month : birthday.month, birthday.day).getYearSixtyCycle().getEarthBranch().getZodiac().toString();
  return SolarDay.fromYmd(birthday.year, birthday.month, birthday.day).getLunarDay().getYearSixtyCycle().getEarthBranch().getZodiac().toString();
}

export function formatBirthday(birthday: Birthday): string {
  if (birthday.calendar === 'solar') return `公历 ${birthday.year}-${pad(birthday.month)}-${pad(birthday.day)}`;
  return `农历 ${birthday.year}年${birthday.isLeapMonth ? '闰' : ''}${birthday.month}月${birthday.day}日`;
}

export function lunarMonthDayCount(year: number, month: number, isLeapMonth: boolean): number {
  try { return LunarMonth.fromYm(year, isLeapMonth ? -month : month).getDayCount(); } catch { return 29; }
}

export function lunarLeapMonth(year: number): number {
  try { return LunarYear.fromYear(year).getLeapMonth(); } catch { return 0; }
}

export function toLocalDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as DayKey;
}

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSolarLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
