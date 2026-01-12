import { create } from 'zustand';
import type { Person, CreatePersonRequest, UpdatePersonRequest } from '@still-alive/types';
import { apiClient } from '../lib/api';

interface PersonState {
  // List
  persons: Person[];
  isLoading: boolean;
  sortBy: 'createdAt' | 'birthday';

  // Search
  searchKeyword: string;

  // Detail
  currentPerson: Person | null;
  isDetailLoading: boolean;

  // Create/Update
  isCreating: boolean;
  isUpdating: boolean;
  error: string | null;

  // Birthdays
  todayBirthdays: Person[];

  // Computed
  filteredPersons: () => Person[];

  // Actions
  fetchPersons: () => Promise<void>;
  fetchTodayBirthdays: () => Promise<void>;
  setSearchKeyword: (keyword: string) => void;
  setSortBy: (sort: 'createdAt' | 'birthday') => void;
  fetchPersonDetail: (id: string) => Promise<void>;
  createPerson: (data: CreatePersonRequest) => Promise<Person>;
  updatePerson: (id: string, data: UpdatePersonRequest) => Promise<Person>;
  deletePerson: (id: string) => Promise<void>;
  clearCurrentPerson: () => void;
  reset: () => void;
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
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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

  fetchPersons: async () => {
    set({ isLoading: true });
    try {
      const persons = await apiClient.getPeople();
      set({ persons, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取人物列表失败';
      set({ error: message, isLoading: false });
    }
  },

  fetchTodayBirthdays: async () => {
    try {
      const todayBirthdays = await apiClient.getTodayBirthdays();
      set({ todayBirthdays });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取今日生日失败';
      set({ error: message });
    }
  },

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  setSortBy: (sort) => set({ sortBy: sort }),

  fetchPersonDetail: async (id) => {
    set({ isDetailLoading: true });
    try {
      const person = await apiClient.getPerson(id);
      set({ currentPerson: person, isDetailLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取人物详情失败';
      set({ error: message, isDetailLoading: false });
    }
  },

  createPerson: async (data) => {
    set({ isCreating: true, error: null });
    try {
      const person = await apiClient.createPerson(data);
      set((state) => ({
        persons: [person, ...state.persons],
        isCreating: false,
      }));
      return person;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建人物失败';
      set({ error: message, isCreating: false });
      throw error;
    }
  },

  updatePerson: async (id, data) => {
    set({ isUpdating: true, error: null });
    try {
      const person = await apiClient.updatePerson(id, data);
      set((state) => ({
        persons: state.persons.map((p) => (p.id === id ? person : p)),
        currentPerson: person,
        isUpdating: false,
      }));
      return person;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新人物失败';
      set({ error: message, isUpdating: false });
      throw error;
    }
  },

  deletePerson: async (id) => {
    try {
      await apiClient.deletePerson(id);
      set((state) => ({
        persons: state.persons.filter((p) => p.id !== id),
        currentPerson: null,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除人物失败';
      set({ error: message });
      throw error;
    }
  },

  clearCurrentPerson: () => set({ currentPerson: null }),

  reset: () =>
    set({
      persons: [],
      searchKeyword: '',
      currentPerson: null,
      todayBirthdays: [],
      error: null,
    }),
}));
