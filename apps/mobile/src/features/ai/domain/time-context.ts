import { SolarDay } from 'tyme4ts';

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// tyme4ts 输出「十一月 / 十二月」，App 里统一叫「冬月 / 腊月」，与用户平常说的保持一致。
const LUNAR_MONTH_ALIASES: Record<string, string> = {
  十一月: '冬月',
  十二月: '腊月',
  闰十一月: '闰冬月',
  闰十二月: '闰腊月',
};

function lunarMonthName(name: string): string {
  return LUNAR_MONTH_ALIASES[name] ?? name;
}

/** 公历日期对应的农历月日，例如「腊月初八」；换算失败时返回 null。 */
export function lunarDayLabel(date: Date): string | null {
  try {
    const lunar = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunarDay();
    return `${lunarMonthName(lunar.getLunarMonth().getName())}${lunar.getName()}`;
  } catch {
    return null;
  }
}

/** 公历日期对应的农历年名与月日，例如「丙午年冬月初八」。 */
export function lunarYearDayLabel(date: Date): string | null {
  try {
    const lunar = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunarDay();
    const yearName = lunar.getLunarMonth().getLunarYear().getName().replace(/^农历/u, '');
    return `${yearName}${lunarMonthName(lunar.getLunarMonth().getName())}${lunar.getName()}`;
  } catch {
    return null;
  }
}

export function formatLocalDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatClock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function timeZoneLabel(date: Date): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) return zone;
  } catch {
    // 部分运行时没有 Intl 时区数据，退回 UTC 偏移。
  }
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

/**
 * 问答的资料块会带上这段本机时间。
 * 只给确定事实，不替模型做相对日期换算，避免它把「下个月」按错误口径理解。
 */
export function buildTimeContext(now: Date): string {
  const dayKey = formatLocalDayKey(now);
  const lunar = lunarYearDayLabel(now);
  return [
    `现在：${dayKey} ${formatClock(now)}（${WEEKDAY_LABELS[now.getDay()]}；${timeZoneLabel(now)}）`,
    `今天：${dayKey}${lunar ? `（农历${lunar}）` : ''}`,
  ].join('\n');
}
