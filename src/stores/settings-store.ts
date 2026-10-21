import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DateFormat, ThemeColor } from '@/types';

export type Language = 'en' | 'bn';

/** Company-wide display preferences (from GET /settings/app-config). */
export interface DisplayPrefs {
  currency: string;
  amountDecimals: number;
  quantityDecimals: number;
  dateFormat: DateFormat;
  timeFormat: '12h' | '24h';
  timezone: string;
  themeColor: ThemeColor;
}

export const DEFAULT_PREFS: DisplayPrefs = {
  currency: import.meta.env.VITE_DEFAULT_CURRENCY || 'BDT',
  amountDecimals: 2,
  quantityDecimals: 2,
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
  timezone: 'Asia/Dhaka',
  themeColor: 'neutral',
};

interface SettingsState extends DisplayPrefs {
  language: Language;
  sidebarOpen: boolean;
  activeBranchId: string | null;
  setLanguage: (language: Language) => void;
  setCurrency: (currency: string) => void;
  setPrefs: (prefs: Partial<DisplayPrefs>) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveBranch: (branchId: string | null) => void;
}

/**
 * Global UI preferences, persisted per browser (so the first paint after reload already
 * uses the company's formats). Light/dark theme is handled by next-themes.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      language: (import.meta.env.VITE_DEFAULT_LOCALE as Language) || 'en',
      sidebarOpen: true,
      activeBranchId: null,
      setLanguage: (language) => set({ language }),
      setCurrency: (currency) => set({ currency }),
      setPrefs: (prefs) => set(prefs),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setActiveBranch: (activeBranchId) => set({ activeBranchId }),
    }),
    { name: 'holydeen-settings' },
  ),
);
