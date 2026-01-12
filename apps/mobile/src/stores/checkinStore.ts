import { create } from 'zustand';
import type { Checkin, CheckinStats } from '@still-alive/types';
import { apiClient } from '../lib/api';

interface CheckinState {
  // Today's checkin state
  todayCheckedIn: boolean;
  todayCheckin: Checkin | null;
  isCheckinLoading: boolean;

  // Stats
  stats: CheckinStats | null;
  isStatsLoading: boolean;

  // Calendar
  currentMonth: Date;
  monthlyCheckins: Checkin[];
  isCalendarLoading: boolean;

  // History list
  checkins: Checkin[];
  hasMore: boolean;
  isListLoading: boolean;
  page: number;

  // Error
  error: string | null;

  // Actions
  checkTodayStatus: () => Promise<void>;
  checkinToday: (content?: string, photo?: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchMonthlyCheckins: (year?: number, month?: number) => Promise<void>;
  setCurrentMonth: (date: Date) => void;
  fetchCheckinHistory: (page?: number) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  reset: () => void;
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
  hasMore: true,
  isListLoading: false,
  page: 0,
  error: null,

  checkTodayStatus: async () => {
    try {
      const result = await apiClient.getTodayCheckin();
      set({
        todayCheckedIn: result.checkedIn,
        todayCheckin: result.checkin,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取状态失败';
      set({ error: message });
    }
  },

  checkinToday: async (content, photo) => {
    set({ isCheckinLoading: true, error: null });
    try {
      const checkin = await apiClient.checkinToday({ content, photo });
      set({
        todayCheckedIn: true,
        todayCheckin: checkin,
        isCheckinLoading: false,
      });
      // Refresh stats after checkin
      get().fetchStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '打卡失败';
      set({ error: message, isCheckinLoading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    set({ isStatsLoading: true });
    try {
      const stats = await apiClient.getCheckinStats();
      set({ stats, isStatsLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取统计失败';
      set({ error: message, isStatsLoading: false });
    }
  },

  fetchMonthlyCheckins: async (year, month) => {
    set({ isCalendarLoading: true });
    const currentMonth = get().currentMonth;
    const y = year ?? currentMonth.getFullYear();
    const m = month ?? currentMonth.getMonth() + 1;
    try {
      const checkins = await apiClient.getCheckinHistory(y, m);
      set({ monthlyCheckins: checkins, isCalendarLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取日历数据失败';
      set({ error: message, isCalendarLoading: false });
    }
  },

  setCurrentMonth: (date) => {
    set({ currentMonth: date });
    get().fetchMonthlyCheckins(date.getFullYear(), date.getMonth() + 1);
  },

  fetchCheckinHistory: async (page = 0) => {
    set({ isListLoading: true });
    try {
      const checkins = await apiClient.getCheckinHistory();
      set({
        checkins,
        page,
        hasMore: checkins.length >= 20,
        isListLoading: false,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取历史记录失败';
      set({ error: message, isListLoading: false });
    }
  },

  loadMoreHistory: async () => {
    const { page, isListLoading, hasMore } = get();
    if (isListLoading || !hasMore) return;

    set({ isListLoading: true });
    try {
      const newPage = page + 1;
      const newCheckins = await apiClient.getCheckinHistory();
      set((state) => ({
        checkins: [...state.checkins, ...newCheckins],
        page: newPage,
        hasMore: newCheckins.length >= 20,
        isListLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载更多失败';
      set({ error: message, isListLoading: false });
    }
  },

  reset: () =>
    set({
      todayCheckedIn: false,
      todayCheckin: null,
      stats: null,
      monthlyCheckins: [],
      checkins: [],
      page: 0,
      hasMore: true,
      error: null,
    }),
}));
