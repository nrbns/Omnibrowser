import { create } from 'zustand';

export type SuspensionReason = 'inactivity' | 'manual' | 'memory';

export interface SuspendedTabRecord {
  tabId: string;
  title?: string;
  url?: string;
  snapshot?: string | null;
  suspendedAt: number;
  lastActiveAt?: number;
  acknowledged?: boolean;
  reason?: SuspensionReason;
}

interface SuspensionEvent {
  tabId: string;
  type: 'suspended' | 'restored';
  timestamp: number;
  reason?: SuspensionReason;
}

interface TabSuspensionState {
  suspensions: Record<string, SuspendedTabRecord>;
  lastEvent?: SuspensionEvent;
  setSuspended: (record: SuspendedTabRecord) => void;
  acknowledge: (tabId: string) => void;
  resolve: (tabId: string, options?: { silent?: boolean }) => void;
  cleanup: () => void; // Clean up old suspensions
}

const MAX_SUSPENSIONS = 100; // Limit number of stored suspensions
const SUSPENSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const useTabSuspensionStore = create<TabSuspensionState>(set => ({
  suspensions: {},
  lastEvent: undefined,
  setSuspended: record =>
    set(state => {
      let suspensions: Record<string, SuspendedTabRecord> = {
        ...state.suspensions,
        [record.tabId]: {
          ...(state.suspensions[record.tabId] ?? {}),
          ...record,
          acknowledged: false,
        },
      };

      // Limit number of suspensions to prevent memory leaks
      const suspensionEntries = Object.entries(suspensions);
      if (suspensionEntries.length > MAX_SUSPENSIONS) {
        // Remove oldest suspensions
        const sorted = suspensionEntries.sort(
          (a, b) => (a[1].suspendedAt || 0) - (b[1].suspendedAt || 0)
        );
        const toKeep = sorted.slice(-MAX_SUSPENSIONS);
        suspensions = Object.fromEntries(toKeep);
      }

      return {
        suspensions,
        lastEvent: {
          tabId: record.tabId,
          type: 'suspended',
          timestamp: Date.now(),
          reason: record.reason,
        },
      };
    }),
  acknowledge: tabId =>
    set(state => {
      const current = state.suspensions[tabId];
      if (!current) {
        return state;
      }
      return {
        suspensions: {
          ...state.suspensions,
          [tabId]: {
            ...current,
            acknowledged: true,
          },
        },
      };
    }),
  resolve: (tabId, options) =>
    set(state => {
      if (!state.suspensions[tabId]) {
        return state;
      }
      const next = { ...state.suspensions };
      delete next[tabId];
      return {
        suspensions: next,
        lastEvent: options?.silent
          ? state.lastEvent
          : {
              tabId,
              type: 'restored',
              timestamp: Date.now(),
            },
      };
    }),
  cleanup: () =>
    set(state => {
      const now = Date.now();
      const suspensions: Record<string, SuspendedTabRecord> = {};

      // Remove old suspensions (older than 7 days)
      Object.entries(state.suspensions).forEach(([tabId, record]) => {
        const age = now - (record.suspendedAt || 0);
        if (age < SUSPENSION_MAX_AGE_MS) {
          suspensions[tabId] = record;
        }
      });

      return { suspensions };
    }),
}));
