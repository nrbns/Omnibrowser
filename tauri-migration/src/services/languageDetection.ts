import { log } from '../utils/logger';

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  method: 'indicbert' | 'mbart' | 'client' | 'fallback';
  isIndic: boolean;
}

const INDIC_LANG_CODES = ['hi', 'ta', 'te', 'bn', 'mr', 'ml', 'gu', 'pa', 'ur'];

const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  hi: [/[\u0900-\u097F]/, /\b(है|में|क्या|कब|क्यों|कहाँ)\b/],
  bn: [/[\u0980-\u09FF]/, /\b(কি|কিভাবে|কোথায়|কখন)\b/],
  ta: [/[\u0B80-\u0BFF]/, /\b(எப்படி|எங்கே|எப்போது|ஏன்)\b/],
  te: [/[\u0C00-\u0C7F]/, /\b(ఎలా|ఎక్కడ|ఎప్పుడు|ఎందుకు)\b/],
  mr: [/[\u0900-\u097F]/, /\b(कधी|का|कुठे|काय)\b/],
  ur: [/[\u0600-\u06FF]/, /\b(کیا|کیسے|کہاں|کب)\b/],
};

const ENGLISH_PATTERN = /[a-zA-Z]/;

const mapIndic = (language: string): boolean => INDIC_LANG_CODES.includes(language);

export async function detectLanguage(text: string): Promise<LanguageDetectionResult> {
  if (!text || text.trim().length < 2) {
    return {
      language: 'en',
      confidence: 0.5,
      method: 'fallback',
      isIndic: false,
    };
  }

  const trimmed = text.trim();

  // Try lightweight heuristics for Indic scripts
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    const matched = patterns.some(pattern => pattern.test(trimmed));
    if (matched) {
      return {
        language: lang,
        confidence: 0.9,
        method: 'client',
        isIndic: mapIndic(lang),
      };
    }
  }

  if (ENGLISH_PATTERN.test(trimmed)) {
    return {
      language: 'en',
      confidence: 0.75,
      method: 'client',
      isIndic: false,
    };
  }

  try {
    const { ipc } = await import('../lib/ipc-typed');
    const result = await ipc.research?.queryEnhanced?.({
      query: `Detect language: ${trimmed.slice(0, 250)}`,
      language: 'auto',
    });
    if (result && typeof result === 'object' && 'languageLabel' in result) {
      // When backend returns structured data, attempt to read it
      const detected = (result as any).languageLabelCode || (result as any).language || 'en';
      const confidence = (result as any).languageConfidence || 0.85;
      return {
        language: detected,
        confidence,
        method: 'indicbert',
        isIndic: mapIndic(detected),
      };
    }
  } catch {
    log.info('[LanguageDetection] Backend detection unavailable, falling back to heuristics');
  }

  return {
    language: 'en',
    confidence: 0.5,
    method: 'fallback',
    isIndic: false,
  };
}
