/**
 * 打卡状态管理 (本地优先)
 * 所有打卡操作在本地完成，统计本地计算
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { LocalCheckin, CheckinStats } from '@still-alive/local-storage';
import { calculateCheckinStats } from '@still-alive/local-storage';
import { getLocalStorage } from '../lib/localStorage';

interface CheckinState {
  // Today's checkin state
  todayCheckedIn: boolean;
  todayCheckin: LocalCheckin | null;
  isCheckinLoading: boolean;

  // Stats (本地计算)
  stats: CheckinStats | null;
  isStatsLoading: boolean;

  // Calendar
  currentMonth: Date;
  monthlyCheckins: LocalCheckin[];
  isCalendarLoading: boolean;

  // All checkins
  checkins: LocalCheckin[];
  isListLoading: boolean;

  // Error
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  checkTodayStatus: () => Promise<void>;
  checkinToday: (content?: string, photo?: string) => Promise<void>;
  calculateStats: () => void;
  fetchMonthlyCheckins: (year?: number, month?: number) => Promise<void>;
  setCurrentMonth: (date: Date) => void;
  fetchAllCheckins: () => Promise<void>;
  reset: () => void;
}

/**
 * 获取今日日期字符串 YYYY-MM-DD
 */
function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const useCheckinStore = create<CheckinState>((set, get) => ({
  // Initial state
  todayCheckedIn: false,
  todayCheckin: null,
  isCheckinLoading: false,
  stats: null,
  isStatsLoading: false,
  currentMonth: new Date(),
  monthlyCheckins: [],
  isCalendarLoading: false,
  checkins: [],
  isListLoading: false,
  error: null,

  /**
   * 初始化 Store (从本地存储加载数据)
   */
  initialize: async () => {
    try {
      const storage = getLocalStorage();

      // 加载所有打卡记录
      const checkins = await storage.getAllCheckins();
      set({ checkins });

      // 检查今日状态
      await get().checkTodayStatus();

      // 计算统计
      get().calculateStats();

      // 加载当月打卡
      const today = new Date();
      await get().fetchMonthlyCheckins(today.getFullYear(), today.getMonth() + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : '初始化失败';
      set({ error: message });
    }
  },

  /**
   * 检查今日打卡状态 (本地)
   */
  checkTodayStatus: async () => {
    try {
      const storage = getLocalStorage();
      const today = getTodayString();
      const checkin = await storage.getCheckin(today);

      set({
        todayCheckedIn: !!checkin,
        todayCheckin: checkin,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取状态失败';
      set({ error: message });
    }
  },

  /**
   * 今日打卡 (本地)
   */
  checkinToday: async (content, photo) => {
    set({ isCheckinLoading: true, error: null });

    try {
      const storage = getLocalStorage();
      const today = getTodayString();
      const now = Date.now();

      // 检查是否已有今日记录 (更新还是新建)
      const existing = await storage.getCheckin(today);

      const checkin: LocalCheckin = {
        id: existing?.id || uuidv4(),
        date: today,
        content: content || existing?.content,
        photo: photo || existing?.photo,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        syncStatus: 'pending', // 标记待同步
      };

      // 保存到本地存储
      await storage.saveCheckin(checkin);

      // 更新 state
      set((state) => ({
        todayCheckedIn: true,
        todayCheckin: checkin,
        isCheckinLoading: false,
        checkins: existing
          ? state.checkins.map((c) => (c.id === checkin.id ? checkin : c))
          : [checkin, ...state.checkins],
      }));

      // 重新计算统计
      get().calculateStats();

      // 更新当月打卡
      const date = new Date();
      await get().fetchMonthlyCheckins(date.getFullYear(), date.getMonth() + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : '打卡失败';
      set({ error: message, isCheckinLoading: false });
      throw error;
    }
  },

  /**
   * 计算打卡统计 (本地)
   */
  calculateStats: () => {
    set({ isStatsLoading: true });

    const { checkins } = get();
    const stats = calculateCheckinStats(checkins);

    set({ stats, isStatsLoading: false });
  },

  /**
   * 获取指定月份的打卡记录 (本地)
   */
  fetchMonthlyCheckins: async (year, month) => {
    set({ isCalendarLoading: true });

    const currentMonth = get().currentMonth;
    const y = year ?? currentMonth.getFullYear();
    const m = month ?? currentMonth.getMonth() + 1;

    try {
      const storage = getLocalStorage();
      const checkins = await storage.getCheckinsByMonth(y, m);

      set({ monthlyCheckins: checkins, isCalendarLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取日历数据失败';
      set({ error: message, isCalendarLoading: false });
    }
  },

  /**
   * 设置当前月份并加载数据
   */
  setCurrentMonth: (date) => {
    set({ currentMonth: date });
    get().fetchMonthlyCheckins(date.getFullYear(), date.getMonth() + 1);
  },

  /**
   * 获取所有打卡记录 (本地)
   */
  fetchAllCheckins: async () => {
    set({ isListLoading: true });

    try {
      const storage = getLocalStorage();
      const checkins = await storage.getAllCheckins();

      set({ checkins, isListLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取历史记录失败';
      set({ error: message, isListLoading: false });
    }
  },

  /**
   * 重置状态
   */
  reset: () =>
    set({
      todayCheckedIn: false,
      todayCheckin: null,
      stats: null,
      monthlyCheckins: [],
      checkins: [],
      error: null,
    }),
}));
