import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmergencyConfig } from '@still-alive/types';
import { apiClient } from '../lib/api';

export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  // Quick stats
  totalDays: number;
  totalPersons: number;
  totalRecords: number;

  // Emergency config
  emergencyConfig: EmergencyConfig | null;
  isConfigLoading: boolean;
  isConfigUpdating: boolean;

  // Reminder settings (local)
  reminderEnabled: boolean;
  reminderTime: string; // HH:mm format

  // Theme (local)
  theme: ThemeMode;

  error: string | null;

  // Actions
  fetchEmergencyConfig: () => Promise<void>;
  updateEmergencyConfig: (data: Partial<EmergencyConfig>) => Promise<void>;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setTheme: (theme: ThemeMode) => void;
  fetchQuickStats: () => Promise<void>;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      totalDays: 0,
      totalPersons: 0,
      totalRecords: 0,
      emergencyConfig: null,
      isConfigLoading: false,
      isConfigUpdating: false,
      reminderEnabled: true,
      reminderTime: '21:00',
      theme: 'system',
      error: null,

      fetchEmergencyConfig: async () => {
        set({ isConfigLoading: true });
        try {
          const config = await apiClient.getEmergencyConfig();
          set({ emergencyConfig: config, isConfigLoading: false });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '获取配置失败';
          set({ error: message, isConfigLoading: false });
        }
      },

      updateEmergencyConfig: async (data) => {
        set({ isConfigUpdating: true, error: null });
        try {
          const config = await apiClient.updateEmergencyConfig(data);
          set({ emergencyConfig: config, isConfigUpdating: false });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '更新配置失败';
          set({ error: message, isConfigUpdating: false });
          throw error;
        }
      },

      setReminderEnabled: (enabled) => set({ reminderEnabled: enabled }),
      setReminderTime: (time) => set({ reminderTime: time }),
      setTheme: (theme) => set({ theme }),

      fetchQuickStats: async () => {
        try {
          const stats = await apiClient.getCheckinStats();
          const persons = await apiClient.getPeople();
          set({
            totalDays: stats.totalDays,
            totalRecords: stats.totalRecords,
            totalPersons: persons.length,
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '获取统计失败';
          set({ error: message });
        }
      },

      reset: () =>
        set({
          emergencyConfig: null,
          totalDays: 0,
          totalPersons: 0,
          totalRecords: 0,
          error: null,
        }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        reminderEnabled: state.reminderEnabled,
        reminderTime: state.reminderTime,
        theme: state.theme,
      }),
    }
  )
);
