import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState } from './appStore';

type SearchEngine = 'google' | 'duckduckgo' | 'bing' | 'yahoo' | 'all' | 'mock';

type GeneralSettings = {
  defaultMode: AppState['mode'];
  startupBehavior: 'newTab' | 'restore';
  telemetryOptIn: boolean;
  showKeyboardHints: boolean;
  allowBetaUpdates: boolean;
};

type PrivacySettings = {
  localOnlyMode: boolean;
  doNotTrack: boolean;
  clearOnExit: boolean;
  blockThirdPartyCookies: boolean;
};

type AppearanceSettings = {
  theme: 'light' | 'dark' | 'system';
  compactUI: boolean;
  showTabNumbers: boolean;
  accent: 'blue' | 'purple' | 'emerald';
};

type AccountSettings = {
  displayName: string;
  email: string;
  workspace: string;
  avatarUrl?: string;
  lastSyncedAt?: number;
};

type SettingsData = {
  general: GeneralSettings;
  privacy: PrivacySettings;
  appearance: AppearanceSettings;
  account: AccountSettings;
  videoDownloadConsent: boolean;
  searchEngine: SearchEngine;
};

type SettingsState = SettingsData & {
  setConsent: (value: boolean) => void;
  setSearchEngine: (engine: SearchEngine) => void;
  updateGeneral: (partial: Partial<GeneralSettings>) => void;
  updatePrivacy: (partial: Partial<PrivacySettings>) => void;
  updateAppearance: (partial: Partial<AppearanceSettings>) => void;
  updateAccount: (partial: Partial<AccountSettings>) => void;
  resetSettings: () => void;
};

const createDefaults = (): SettingsData => ({
  general: {
    defaultMode: 'Browse',
    startupBehavior: 'newTab',
    telemetryOptIn: false,
    showKeyboardHints: true,
    allowBetaUpdates: false,
  },
  privacy: {
    localOnlyMode: false,
    doNotTrack: true,
    clearOnExit: false,
    blockThirdPartyCookies: true,
  },
  appearance: {
    theme: 'dark',
    compactUI: false,
    showTabNumbers: true,
    accent: 'purple',
  },
  account: {
    displayName: 'Explorer',
    email: 'you@regen.app',
    workspace: 'Personal',
    avatarUrl: undefined,
    lastSyncedAt: Date.now(),
  },
  videoDownloadConsent: false,
  searchEngine: 'duckduckgo',
});

const dataKeys: Array<keyof SettingsData> = [
  'general',
  'privacy',
  'appearance',
  'account',
  'videoDownloadConsent',
  'searchEngine',
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, _get) => ({
      ...createDefaults(),
      setConsent: (value) => set({ videoDownloadConsent: value }),
      setSearchEngine: (searchEngine) => set({ searchEngine }),
      updateGeneral: (partial) =>
        set((state) => ({ general: { ...state.general, ...partial } })),
      updatePrivacy: (partial) =>
        set((state) => ({ privacy: { ...state.privacy, ...partial } })),
      updateAppearance: (partial) =>
        set((state) => ({ appearance: { ...state.appearance, ...partial } })),
      updateAccount: (partial) =>
        set((state) => ({ account: { ...state.account, ...partial } })),
      resetSettings: () => {
        const defaults = createDefaults();
        set(() => defaults);
      },
    }),
    {
      name: 'regen:settings-v1',
      version: 1,
      partialize: (state) => {
        const persisted: Partial<SettingsData> = {};
        for (const key of dataKeys) {
          // @ts-ignore - dynamic assignment
          persisted[key] = state[key];
        }
        return persisted;
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<SettingsData>),
      }),
    },
  ),
);
