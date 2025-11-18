import { create } from 'zustand';

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

type TabsState = {
  tabs: Tab[];
  activeId: string | null;
  add: (t: Tab) => void;
  setActive: (id: string) => void;
  setAll: (tabs: Tab[]) => void;
  remove: (id: string) => void;
  getTabsForMode: (mode: string) => Tab[];
  updateTab: (id: string, updates: Partial<Tab>) => void;
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,
  add: (t) => set((s) => ({ tabs: [...s.tabs, t], activeId: t.id })),
  setActive: (id) => set({ activeId: id }),
  setAll: (tabs) => set({ tabs, activeId: tabs.find(t=>t.active)?.id || tabs[0]?.id || null }),
  remove: (id) => set(s => ({ tabs: s.tabs.filter(t=>t.id !== id), activeId: s.activeId === id ? (s.tabs.find(t=>t.id !== id)?.id || null) : s.activeId })),
  getTabsForMode: (mode: string) => {
    const state = get();
    return state.tabs.filter(t => !t.appMode || t.appMode === mode);
  },
  updateTab: (id: string, updates: Partial<Tab>) => set(s => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, ...updates } : t)
  }))
}));


