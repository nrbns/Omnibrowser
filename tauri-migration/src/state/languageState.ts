import { create } from 'zustand';

type DetectionMethod = 'indicbert' | 'mbart' | 'client' | 'fallback';

type LanguageState = {
  detectedLanguage: string;
  detectedConfidence: number;
  detectedMethod: DetectionMethod;
  lastUpdated: number | null;
  setDetectedLanguage: (language: string, confidence?: number, method?: DetectionMethod) => void;
  resetDetectedLanguage: () => void;
};

export const useLanguageState = create<LanguageState>(set => ({
  detectedLanguage: 'en',
  detectedConfidence: 0.5,
  detectedMethod: 'fallback',
  lastUpdated: null,
  setDetectedLanguage: (language, confidence = 0.9, method = 'client') =>
    set({
      detectedLanguage: language,
      detectedConfidence: confidence,
      detectedMethod: method,
      lastUpdated: Date.now(),
    }),
  resetDetectedLanguage: () =>
    set({
      detectedLanguage: 'en',
      detectedConfidence: 0.5,
      detectedMethod: 'fallback',
      lastUpdated: null,
    }),
}));

export function getActiveLanguage(preference?: string, detected?: string) {
  if (preference && preference !== 'auto') return preference;
  return detected || 'en';
}
