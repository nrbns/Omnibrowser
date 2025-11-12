import { create } from 'zustand';

export type MetricSample = {
  timestamp: number;
  cpu: number;
  memory: number;
  carbonIntensity?: number;
};

export type MetricsState = {
  latest: MetricSample | null;
  history: MetricSample[];
  pushSample: (sample: MetricSample) => void;
  clear: () => void;
};

const MAX_HISTORY = 60;

export const useMetricsStore = create<MetricsState>((set) => ({
  latest: null,
  history: [],
  pushSample: (sample) =>
    set((state) => {
      const nextHistory = [...state.history, sample].slice(-MAX_HISTORY);
      return {
        latest: sample,
        history: nextHistory,
      };
    }),
  clear: () => set({ latest: null, history: [] }),
}));
