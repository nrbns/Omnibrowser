import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Tab = {
  id: string;
  title: string;
  active?: boolean;
  url?: string;
  containerId?: string;
  containerColor?: string;
  containerName?: string;
  mode?: 'normal' | 'ghost' | 'private';
  appMode?: 'Browse' | 'Research' | 'Trade' | 'Games' | 'Docs' | 'Images' | 'Threats' | 'GraphMind';
  createdAt?: number;
  lastActiveAt?: number;
  sessionId?: string;
  profileId?: string;
  sleeping?: boolean;
};

export type ClosedTab = {
  closedId: string;
  title?: string;
  url?: string;
  appMode?: Tab['appMode'];
  mode?: Tab['mode'];
  containerId?: string;
  containerName?: string;
  containerColor?: string;
  closedAt: number;
};

type TabsState = {
  tabs: Tab[];
  activeId: string | null;
  recentlyClosed: ClosedTab[];
  add: (t: Tab) => void;
  setActive: (id: string | null) => void;
  setAll: (tabs: Tab[]) => void;
  remove: (id: string) => void;
  getTabsForMode: (mode: string) => Tab[];
  updateTab: (id: string, updates: Partial<Tab>) => void;
  rememberClosedTab: (tab: Tab) => void;
  popRecentlyClosed: () => ClosedTab | undefined;
  removeRecentlyClosed: (closedId: string) => void;
  pushRecentlyClosed: (entry: ClosedTab) => void;
  clearRecentlyClosed: () => void;
};

const MAX_RECENTLY_CLOSED = 12;

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeId: null,
      recentlyClosed: [],
      add: (tab) =>
        set((state) => ({
          tabs: [...state.tabs, { ...tab, createdAt: tab.createdAt ?? Date.now() }],
          activeId: tab.id,
        })),
      setActive: (id) =>
        set((state) => ({
          activeId: id,
          tabs: state.tabs.map((tab) =>
            tab.id === id ? { ...tab, active: true, lastActiveAt: Date.now() } : { ...tab, active: false },
          ),
        })),
      setAll: (tabs) =>
        set(() => {
          const normalized = tabs.map((tab, index) => ({
            ...tab,
            createdAt: tab.createdAt ?? Date.now(),
            lastActiveAt: tab.lastActiveAt ?? Date.now() - (tabs.length - index),
          }));
          const activeCandidate = normalized.find((tab) => tab.active) ?? normalized[0] ?? null;
          return {
            tabs: normalized,
            activeId: activeCandidate ? activeCandidate.id : null,
          };
        }),
      remove: (id) =>
        set((state) => {
          const remaining = state.tabs.filter((tab) => tab.id !== id);
          const nextActive =
            state.activeId === id
              ? remaining.find((tab) => tab.appMode === state.tabs.find((t) => t.id === id)?.appMode) ?? remaining[0] ?? null
              : state.tabs.find((tab) => tab.id === state.activeId) ?? null;
          return {
            tabs: remaining,
            activeId: nextActive ? nextActive.id : null,
          };
        }),
      getTabsForMode: (mode: string) => {
        const state = get();
        return state.tabs.filter((tab) => !tab.appMode || tab.appMode === mode);
      },
      updateTab: (id: string, updates: Partial<Tab>) =>
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...updates } : tab)),
        })),
      rememberClosedTab: (tab: Tab) =>
        set((state) => {
          const entry: ClosedTab = {
            closedId: tab.id,
            title: tab.title,
            url: tab.url,
            appMode: tab.appMode,
            mode: tab.mode,
            containerId: tab.containerId,
            containerName: tab.containerName,
            containerColor: tab.containerColor,
            closedAt: Date.now(),
          };
          return {
            recentlyClosed: [entry, ...state.recentlyClosed.filter((item) => item.closedId !== tab.id)].slice(
              0,
              MAX_RECENTLY_CLOSED,
            ),
          };
        }),
      popRecentlyClosed: () => {
        const state = get();
        if (state.recentlyClosed.length === 0) {
          return undefined;
        }
        const [first, ...rest] = state.recentlyClosed;
        set({ recentlyClosed: rest });
        return first;
      },
      removeRecentlyClosed: (closedId: string) =>
        set((state) => ({
          recentlyClosed: state.recentlyClosed.filter((entry) => entry.closedId !== closedId),
        })),
      pushRecentlyClosed: (entry: ClosedTab) =>
        set((state) => ({
          recentlyClosed: [entry, ...state.recentlyClosed.filter((item) => item.closedId !== entry.closedId)].slice(
            0,
            MAX_RECENTLY_CLOSED,
          ),
        })),
      clearRecentlyClosed: () => set({ recentlyClosed: [] }),
    }),
    {
      name: 'regen:tabs-state',
      version: 1,
      partialize: (state) => ({
        tabs: state.tabs,
        activeId: state.activeId,
        recentlyClosed: state.recentlyClosed,
      }),
    },
  ),
);
