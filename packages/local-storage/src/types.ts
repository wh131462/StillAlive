/**
 * 本地存储层统一接口定义
 * 支持 Mobile (SQLite), Web (IndexedDB), 小程序 (wx.getStorage)
 */

// ============ 同步状态 ============
export type SyncStatus = 'pending' | 'synced' | 'conflict';

// ============ 本地数据结构 ============

/**
 * 本地打卡记录
 */
export interface LocalCheckin {
  id: string;                    // UUID v4
  date: string;                  // YYYY-MM-DD (作为唯一键)
  content?: string;              // 有意义的事
  photo?: string;                // 本地文件路径或 base64
  createdAt: number;             // Unix timestamp (ms)
  updatedAt: number;             // 最后修改时间
  syncStatus: SyncStatus;        // 同步状态
  serverVersion?: number;        // 服务端版本号 (用于冲突检测)
}

/**
 * 本地人物档案
 */
export interface LocalPerson {
  id: string;                    // UUID v4
  name: string;                  // 姓名/称呼
  gender?: 'male' | 'female' | 'other';
  birthday?: string;             // MM-DD 格式
  birthYear?: number;            // 出生年份
  photo?: string;                // 照片路径或 base64
  mbti?: string;                 // 人格类型
  impression?: string;           // 个人印象
  experience?: string;           // 共同经历
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
  syncStatus: SyncStatus;        // 同步状态
  serverVersion?: number;        // 服务端版本号
  isDeleted?: boolean;           // 软删除标记
}

/**
 * 本地设置 (仅本地，不同步)
 */
export interface LocalSettings {
  reminderEnabled: boolean;      // 打卡提醒开关
  reminderTime: string;          // 提醒时间 HH:mm
  theme: 'light' | 'dark' | 'system';
  lastSyncAt: number;            // 上次同步时间
}

// ============ 同步相关 ============

/**
 * 待同步变更
 */
export interface PendingChange {
  id: string;                    // 记录 ID
  collection: 'checkins' | 'people';
  operation: 'upsert' | 'delete';
  data: LocalCheckin | LocalPerson | { id: string };
  timestamp: number;             // 变更时间
}

/**
 * 同步元数据
 */
export interface SyncMeta {
  key: string;
  value: string;
}

// ============ 统一存储接口 ============

/**
 * 跨平台本地存储接口
 * 各平台 (Mobile/Web/小程序) 需实现此接口
 */
export interface ILocalStorage {
  // -------- 初始化 --------
  /**
   * 初始化存储 (创建表/索引等)
   */
  initialize(): Promise<void>;

  /**
   * 关闭存储连接
   */
  close(): Promise<void>;

  // -------- 打卡操作 --------
  /**
   * 获取指定日期的打卡记录
   */
  getCheckin(date: string): Promise<LocalCheckin | null>;

  /**
   * 获取所有打卡记录
   */
  getAllCheckins(): Promise<LocalCheckin[]>;

  /**
   * 获取指定月份的打卡记录
   */
  getCheckinsByMonth(year: number, month: number): Promise<LocalCheckin[]>;

  /**
   * 获取指定日期范围的打卡记录
   */
  getCheckinsByDateRange(startDate: string, endDate: string): Promise<LocalCheckin[]>;

  /**
   * 保存打卡记录 (新增或更新)
   */
  saveCheckin(checkin: LocalCheckin): Promise<void>;

  /**
   * 删除打卡记录
   */
  deleteCheckin(id: string): Promise<void>;

  // -------- 人物操作 --------
  /**
   * 获取指定人物
   */
  getPerson(id: string): Promise<LocalPerson | null>;

  /**
   * 获取所有人物
   */
  getAllPeople(): Promise<LocalPerson[]>;

  /**
   * 获取今日生日的人物
   */
  getTodayBirthdays(todayMMDD: string): Promise<LocalPerson[]>;

  /**
   * 保存人物 (新增或更新)
   */
  savePerson(person: LocalPerson): Promise<void>;

  /**
   * 删除人物 (软删除)
   */
  deletePerson(id: string): Promise<void>;

  /**
   * 硬删除人物 (真正删除)
   */
  hardDeletePerson(id: string): Promise<void>;

  // -------- 同步相关 --------
  /**
   * 获取所有待同步的变更
   */
  getPendingChanges(): Promise<PendingChange[]>;

  /**
   * 标记记录为已同步
   */
  markAsSynced(ids: string[]): Promise<void>;

  /**
   * 标记记录存在冲突
   */
  markAsConflict(ids: string[]): Promise<void>;

  /**
   * 获取上次同步时间
   */
  getLastSyncTime(): Promise<number>;

  /**
   * 设置上次同步时间
   */
  setLastSyncTime(time: number): Promise<void>;

  // -------- 批量操作 (用于同步) --------
  /**
   * 批量插入或更新打卡记录
   */
  bulkUpsertCheckins(checkins: LocalCheckin[]): Promise<void>;

  /**
   * 批量插入或更新人物
   */
  bulkUpsertPeople(people: LocalPerson[]): Promise<void>;

  // -------- 设置 --------
  /**
   * 获取本地设置
   */
  getSettings(): Promise<LocalSettings>;

  /**
   * 保存本地设置
   */
  saveSettings(settings: Partial<LocalSettings>): Promise<void>;

  // -------- 清理 --------
  /**
   * 清除所有数据 (用于登出)
   */
  clearAll(): Promise<void>;

  /**
   * 清除指定集合的数据
   */
  clearCollection(collection: 'checkins' | 'people'): Promise<void>;
}

// ============ 统计计算 (本地完成) ============

/**
 * 打卡统计
 */
export interface CheckinStats {
  totalDays: number;             // 总打卡天数
  streak: number;                // 当前连续打卡天数
  totalRecords: number;          // 有内容的记录数
  maxStreak: number;             // 历史最长连续打卡
}

/**
 * 计算打卡统计 (纯函数，本地计算)
 */
export function calculateCheckinStats(checkins: LocalCheckin[]): CheckinStats {
  const totalDays = checkins.length;
  const totalRecords = checkins.filter(c => c.content).length;

  // 按日期排序
  const sortedCheckins = [...checkins].sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  // 计算当前连续打卡天数
  let streak = 0;
  const today = new Date();
  let currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (const checkin of sortedCheckins) {
    const [year, month, day] = checkin.date.split('-').map(Number);
    const checkinDate = new Date(year, month - 1, day);

    const diffDays = Math.floor(
      (currentDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0 || diffDays === 1) {
      streak++;
      currentDate = checkinDate;
    } else {
      break;
    }
  }

  // 计算历史最长连续打卡
  let maxStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const checkin of sortedCheckins.reverse()) {
    const [year, month, day] = checkin.date.split('-').map(Number);
    const checkinDate = new Date(year, month - 1, day);

    if (prevDate === null) {
      tempStreak = 1;
    } else {
      const diffDays = Math.floor(
        (checkinDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) {
        tempStreak++;
      } else {
        maxStreak = Math.max(maxStreak, tempStreak);
        tempStreak = 1;
      }
    }
    prevDate = checkinDate;
  }
  maxStreak = Math.max(maxStreak, tempStreak);

  return {
    totalDays,
    streak,
    totalRecords,
    maxStreak,
  };
}

// ============ 默认设置 ============

export const DEFAULT_SETTINGS: LocalSettings = {
  reminderEnabled: false,
  reminderTime: '21:00',
  theme: 'system',
  lastSyncAt: 0,
};
