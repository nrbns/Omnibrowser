type LanguageMeta = {
  code: string;
  nativeName: string;
  englishName: string;
  flag: string;
  accent: string;
  gradient: [string, string];
  waveform: [string, string];
};

const DEFAULT_META: LanguageMeta = {
  code: 'en',
  nativeName: 'English',
  englishName: 'English',
  flag: '🇺🇸',
  accent: '#38bdf8',
  gradient: ['#2563eb', '#38bdf8'],
  waveform: ['#38bdf8', '#a5f3fc'],
};

export const LANGUAGE_META: Record<string, LanguageMeta> = {
  en: DEFAULT_META,
  hi: {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    flag: '🇮🇳',
    accent: '#f97316',
    gradient: ['#f97316', '#ec4899'],
    waveform: ['#f97316', '#facc15'],
  },
  ta: {
    code: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    flag: '🇮🇳',
    accent: '#a855f7',
    gradient: ['#a855f7', '#ec4899'],
    waveform: ['#a855f7', '#f472b6'],
  },
  bn: {
    code: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    flag: '🇮🇳',
    accent: '#fbbf24',
    gradient: ['#fbbf24', '#f97316'],
    waveform: ['#f97316', '#fbbf24'],
  },
  es: {
    code: 'es',
    nativeName: 'Español',
    englishName: 'Spanish',
    flag: '🇪🇸',
    accent: '#f97316',
    gradient: ['#f97316', '#ef4444'],
    waveform: ['#ef4444', '#fbbf24'],
  },
  fr: {
    code: 'fr',
    nativeName: 'Français',
    englishName: 'French',
    flag: '🇫🇷',
    accent: '#38bdf8',
    gradient: ['#818cf8', '#38bdf8'],
    waveform: ['#38bdf8', '#c084fc'],
  },
};

export const LANGUAGE_OPTIONS = [
  { code: 'auto', label: 'Auto', flag: '🌐' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', flag: '🇮🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export function getLanguageMeta(code?: string): LanguageMeta {
  if (!code) return DEFAULT_META;
  return LANGUAGE_META[code] || DEFAULT_META;
}
