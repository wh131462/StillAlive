/**
 * 人物状态管理 (本地优先)
 * 所有人物操作在本地完成，生日提醒本地计算
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { LocalPerson } from '@still-alive/local-storage';
import { getLocalStorage } from '../lib/localStorage';

// 创建人物请求类型
interface CreatePersonRequest {
  name: string;
  gender?: 'male' | 'female' | 'other';
  birthday?: string;
  birthYear?: number;
  photo?: string;
  mbti?: string;
  impression?: string;
  experience?: string;
}

// 更新人物请求类型
type UpdatePersonRequest = Partial<CreatePersonRequest>;

interface PersonState {
  // List
  persons: LocalPerson[];
  isLoading: boolean;
  sortBy: 'createdAt' | 'birthday';

  // Search
  searchKeyword: string;

  // Detail
  currentPerson: LocalPerson | null;
  isDetailLoading: boolean;

  // Create/Update
  isCreating: boolean;
  isUpdating: boolean;
  error: string | null;

  // Birthdays
  todayBirthdays: LocalPerson[];

  // Computed
  filteredPersons: () => LocalPerson[];

  // Actions
  initialize: () => Promise<void>;
  fetchPersons: () => Promise<void>;
  checkTodayBirthdays: () => Promise<void>;
  setSearchKeyword: (keyword: string) => void;
  setSortBy: (sort: 'createdAt' | 'birthday') => void;
  fetchPersonDetail: (id: string) => Promise<void>;
  createPerson: (data: CreatePersonRequest) => Promise<LocalPerson>;
  updatePerson: (id: string, data: UpdatePersonRequest) => Promise<LocalPerson>;
  deletePerson: (id: string) => Promise<void>;
  clearCurrentPerson: () => void;
  reset: () => void;
}

/**
 * 获取今日 MM-DD 字符串
 */
function getTodayMMDD(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

export const usePersonStore = create<PersonState>((set, get) => ({
  // Initial state
  persons: [],
  isLoading: false,
  sortBy: 'createdAt',
  searchKeyword: '',
  currentPerson: null,
  isDetailLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,
  todayBirthdays: [],

  /**
   * 过滤和排序人物列表 (本地计算)
   */
  filteredPersons: () => {
    const { persons, searchKeyword, sortBy } = get();
    let filtered = persons;

    // Filter by search
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(keyword));
    }

    // Sort
    return [...filtered].sort((a, b) => {
      if (sortBy === 'createdAt') {
        return b.createdAt - a.createdAt;
      }
      // Sort by birthday proximity (month-day comparison)
      if (!a.birthday && !b.birthday) return 0;
      if (!a.birthday) return 1;
      if (!b.birthday) return -1;

      const today = new Date();
      const todayMD = (today.getMonth() + 1) * 100 + today.getDate();

      const [aMonth, aDay] = a.birthday.split('-').map(Number);
      const [bMonth, bDay] = b.birthday.split('-').map(Number);

      const aMD = aMonth * 100 + aDay;
      const bMD = bMonth * 100 + bDay;

      // Calculate days until birthday
      const aDiff = aMD >= todayMD ? aMD - todayMD : aMD + 1231 - todayMD;
      const bDiff = bMD >= todayMD ? bMD - todayMD : bMD + 1231 - todayMD;

      return aDiff - bDiff;
    });
  },

  /**
   * 初始化 Store (从本地存储加载)
   */
  initialize: async () => {
    await get().fetchPersons();
    await get().checkTodayBirthdays();
  },

  /**
   * 获取所有人物 (本地)
   */
  fetchPersons: async () => {
    set({ isLoading: true });
    try {
      const storage = getLocalStorage();
      const persons = await storage.getAllPeople();
      set({ persons, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取人物列表失败';
      set({ error: message, isLoading: false });
    }
  },

  /**
   * 检查今日生日 (本地)
   */
  checkTodayBirthdays: async () => {
    try {
      const storage = getLocalStorage();
      const todayMMDD = getTodayMMDD();
      const todayBirthdays = await storage.getTodayBirthdays(todayMMDD);
      set({ todayBirthdays });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取今日生日失败';
      set({ error: message });
    }
  },

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  setSortBy: (sort) => set({ sortBy: sort }),

  /**
   * 获取人物详情 (本地)
   */
  fetchPersonDetail: async (id) => {
    set({ isDetailLoading: true });
    try {
      const storage = getLocalStorage();
      const person = await storage.getPerson(id);
      set({ currentPerson: person, isDetailLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取人物详情失败';
      set({ error: message, isDetailLoading: false });
    }
  },

  /**
   * 创建人物 (本地)
   */
  createPerson: async (data) => {
    set({ isCreating: true, error: null });
    try {
      const storage = getLocalStorage();
      const now = Date.now();

      const person: LocalPerson = {
        id: uuidv4(),
        name: data.name,
        gender: data.gender,
        birthday: data.birthday,
        birthYear: data.birthYear,
        photo: data.photo,
        mbti: data.mbti,
        impression: data.impression,
        experience: data.experience,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
      };

      await storage.savePerson(person);

      set((state) => ({
        persons: [person, ...state.persons],
        isCreating: false,
      }));

      // 检查是否是今日生日
      await get().checkTodayBirthdays();

      return person;
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建人物失败';
      set({ error: message, isCreating: false });
      throw error;
    }
  },

  /**
   * 更新人物 (本地)
   */
  updatePerson: async (id, data) => {
    set({ isUpdating: true, error: null });
    try {
      const storage = getLocalStorage();
      const existing = await storage.getPerson(id);

      if (!existing) {
        throw new Error('人物不存在');
      }

      const updated: LocalPerson = {
        ...existing,
        ...data,
        updatedAt: Date.now(),
        syncStatus: 'pending',
      };

      await storage.savePerson(updated);

      set((state) => ({
        persons: state.persons.map((p) => (p.id === id ? updated : p)),
        currentPerson: updated,
        isUpdating: false,
      }));

      // 检查生日变化
      await get().checkTodayBirthdays();

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新人物失败';
      set({ error: message, isUpdating: false });
      throw error;
    }
  },

  /**
   * 删除人物 (本地软删除)
   */
  deletePerson: async (id) => {
    try {
      const storage = getLocalStorage();
      await storage.deletePerson(id);

      set((state) => ({
        persons: state.persons.filter((p) => p.id !== id),
        currentPerson: state.currentPerson?.id === id ? null : state.currentPerson,
      }));

      // 更新今日生日
      await get().checkTodayBirthdays();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除人物失败';
      set({ error: message });
      throw error;
    }
  },

  clearCurrentPerson: () => set({ currentPerson: null }),

  /**
   * 重置状态
   */
  reset: () =>
    set({
      persons: [],
      searchKeyword: '',
      currentPerson: null,
      todayBirthdays: [],
      error: null,
    }),
}));
