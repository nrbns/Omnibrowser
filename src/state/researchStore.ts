import { create } from 'zustand';

export type Cite = {
  id: string;
  title: string;
  url: string;
  publishedAt?: string;
  snippet?: string;
  fragmentUrl?: string;
  text?: string;
  domain?: string;
  relevanceScore?: number;
};

export type ResearchIssue = {
  type: 'uncited' | 'contradiction';
  sentenceIdx: number;
  detail?: string;
};

export type AnswerChunk = {
  content: string;
  citations: string[];
};

type ResearchState = {
  question: string;
  isLoading: boolean;
  chunks: AnswerChunk[];
  sources: Record<string, Cite[]>;
  issues: ResearchIssue[];
  error?: string;
  previewCiteId: string | null;
  setQuestion: (question: string) => void;
  reset: () => void;
  appendChunk: (chunk: AnswerChunk) => void;
  setSources: (sources: Record<string, Cite[]>) => void;
  setIssues: (issues: ResearchIssue[]) => void;
  setError: (error?: string) => void;
  setLoading: (value: boolean) => void;
  setPreviewCite: (citeId: string | null) => void;
};

export const useResearchStore = create<ResearchState>((set) => ({
  question: '',
  isLoading: false,
  chunks: [],
  sources: {},
  issues: [],
  error: undefined,
  previewCiteId: null,
  setQuestion: (question) => set({ question }),
  reset: () =>
    set({
      chunks: [],
      sources: {},
      issues: [],
      error: undefined,
      previewCiteId: null,
    }),
  appendChunk: (chunk) =>
    set((state) => ({
      chunks: [...state.chunks, chunk],
    })),
  setSources: (sources) => set({ sources }),
  setIssues: (issues) => set({ issues }),
  setError: (error) => set({ error }),
  setLoading: (value) => set({ isLoading: value }),
  setPreviewCite: (citeId) => set({ previewCiteId: citeId }),
}));
