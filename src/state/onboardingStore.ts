import { create } from 'zustand';

interface OnboardingState {
  visible: boolean;
  start: () => void;
  finish: () => void;
  reset: () => void;
}

const STORAGE_KEY = 'omnibrowser:onboarding:completed';

export const onboardingStorage = {
  isCompleted(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  },
  setCompleted(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  visible: false,
  start: () => set({ visible: true }),
  finish: () => {
    onboardingStorage.setCompleted();
    set({ visible: false });
  },
  reset: () => {
    onboardingStorage.clear();
    set({ visible: true });
  },
}));

if (typeof window !== 'undefined') {
  (window as typeof window & { __STORE?: Record<string, unknown> }).__STORE = {
    ...(window as typeof window & { __STORE?: Record<string, unknown> }).__STORE,
    onboarding: useOnboardingStore,
  };
}