import dayjs from 'dayjs';

/**
 * 格式化日期
 */
export function formatDate(date: Date | string, format = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format);
}

/**
 * 判断是否是今天
 */
export function isToday(date: Date | string): boolean {
  return dayjs(date).isSame(dayjs(), 'day');
}

/**
 * 判断是否是今天的生日
 */
export function isBirthdayToday(birthday: string): boolean {
  const today = dayjs().format('MM-DD');
  return birthday === today;
}

/**
 * 计算年龄
 */
export function calculateAge(birthYear: number): number {
  return dayjs().year() - birthYear;
}

/**
 * 获取连续打卡天数文案
 */
export function getStreakText(streak: number): string {
  if (streak === 0) return '今天开始新的记录吧';
  if (streak === 1) return '已连续打卡 1 天';
  if (streak < 7) return `已连续打卡 ${streak} 天，继续加油！`;
  if (streak < 30) return `已连续打卡 ${streak} 天，太棒了！`;
  return `已连续打卡 ${streak} 天，你真的很厉害！`;
}

/**
 * 获取未打卡反馈文案
 */
export function getMissedDayText(missedDays: number): string {
  if (missedDays === 1) {
    return '一定是因为昨天过的很开心吧，才忘了打卡。';
  }
  if (missedDays <= 3) {
    return '好几天没见了，最近过得怎么样？';
  }
  if (missedDays <= 7) {
    return '好久不见，你还好吗？';
  }
  return '很久没有你的消息了，有点担心你...';
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 存储工具
 */
export const storage = {
  get<T>(key: string, defaultValue?: T): T | undefined {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
