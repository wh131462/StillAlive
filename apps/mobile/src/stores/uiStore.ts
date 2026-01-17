import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
  type: ToastType;
  message: string;
  duration?: number;
}

interface UIState {
  // Modals
  isCheckinModalOpen: boolean;
  isPersonDetailOpen: boolean;
  isPersonFormOpen: boolean;
  personFormMode: 'create' | 'edit';

  // Loading
  globalLoading: boolean;
  loadingMessage: string | null;

  // Toast
  toast: ToastConfig | null;

  // Actions
  openCheckinModal: () => void;
  closeCheckinModal: () => void;
  openPersonDetail: () => void;
  closePersonDetail: () => void;
  openPersonForm: (mode?: 'create' | 'edit') => void;
  closePersonForm: () => void;
  setGlobalLoading: (loading: boolean, message?: string | null) => void;
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  isCheckinModalOpen: false,
  isPersonDetailOpen: false,
  isPersonFormOpen: false,
  personFormMode: 'create',
  globalLoading: false,
  loadingMessage: null,
  toast: null,

  // Modal actions
  openCheckinModal: () => set({ isCheckinModalOpen: true }),
  closeCheckinModal: () => set({ isCheckinModalOpen: false }),

  openPersonDetail: () => set({ isPersonDetailOpen: true }),
  closePersonDetail: () => set({ isPersonDetailOpen: false }),

  openPersonForm: (mode = 'create') => set({ isPersonFormOpen: true, personFormMode: mode }),
  closePersonForm: () => set({ isPersonFormOpen: false }),

  // Loading actions
  setGlobalLoading: (loading, message = null) =>
    set({ globalLoading: loading, loadingMessage: message }),

  // Toast actions
  showToast: (config) => set({ toast: config }),
  hideToast: () => set({ toast: null }),
}));
