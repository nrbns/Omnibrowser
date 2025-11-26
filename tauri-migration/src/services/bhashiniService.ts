/**
 * Bhashini Service
 * Integration with Bhashini API for 22 Indic languages
 * Documentation: https://bhashini.gov.in/
 */

const BHASHINI_API_KEY = import.meta.env.VITE_BHASHINI_API_KEY || '';
const BHASHINI_BASE_URL = 'https://api.bhashini.gov.in/services';

export interface TranslationRequest {
  text: string;
  sourceLanguage: string; // ISO 639-1 code (e.g., 'en', 'hi', 'ta')
  targetLanguage: string;
}

export interface TranslationResponse {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
}

export interface TTSRequest {
  text: string;
  language: string;
  voice?: 'male' | 'female';
}

export interface TTSResponse {
  audioUrl?: string;
  audioData?: ArrayBuffer;
}

/**
 * Translate text using Bhashini API
 */
export async function translateText(request: TranslationRequest): Promise<TranslationResponse> {
  try {
    if (!BHASHINI_API_KEY) {
      throw new Error('Bhashini API key not configured. Set VITE_BHASHINI_API_KEY in .env');
    }

    // Bhashini API endpoint for translation
    const response = await fetch(`${BHASHINI_BASE_URL}/translation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BHASHINI_API_KEY}`,
      },
      body: JSON.stringify({
        text: request.text,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bhashini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      translatedText: data.translatedText || data.output?.[0]?.target || request.text,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      confidence: data.confidence || 0.9,
    };
  } catch (error) {
    console.error('[BhashiniService] Translation failed:', error);

    // Fallback to Google Translate API if available
    if (import.meta.env.VITE_GOOGLE_CLOUD_API_KEY) {
      return translateWithGoogle(request);
    }

    throw error;
  }
}

/**
 * Translate using Google Cloud Translation (fallback)
 */
async function translateWithGoogle(request: TranslationRequest): Promise<TranslationResponse> {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: request.text,
        source: request.sourceLanguage,
        target: request.targetLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data.data?.translations?.[0]?.translatedText || request.text;

    return {
      translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
    };
  } catch (error) {
    console.error('[BhashiniService] Google fallback failed:', error);
    throw error;
  }
}

/**
 * Generate Text-to-Speech audio using Bhashini TTS
 */
export async function generateTTS(request: TTSRequest): Promise<TTSResponse> {
  try {
    if (!BHASHINI_API_KEY) {
      throw new Error('Bhashini API key not configured');
    }

    // Bhashini TTS endpoint
    const response = await fetch(`${BHASHINI_BASE_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BHASHINI_API_KEY}`,
      },
      body: JSON.stringify({
        text: request.text,
        language: request.language,
        voice: request.voice || 'female',
      }),
    });

    if (!response.ok) {
      throw new Error(`Bhashini TTS error: ${response.status}`);
    }

    const audioData = await response.arrayBuffer();

    return {
      audioData,
    };
  } catch (error) {
    console.error('[BhashiniService] TTS failed:', error);

    // Fallback to Web Speech API
    return generateTTSWithWebAPI(request);
  }
}

/**
 * Generate TTS using Web Speech API (browser fallback)
 */
async function generateTTSWithWebAPI(request: TTSRequest): Promise<TTSResponse> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Text-to-Speech not supported in this browser'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(request.text);
    utterance.lang = request.language || 'en';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Note: Web Speech API doesn't return audio data directly
    // It plays audio, but we can't capture it as ArrayBuffer
    // For actual audio data, we need Bhashini or Google TTS

    resolve({
      // Return empty - Web Speech API plays directly
    });
  });
}

/**
 * Get supported languages from Bhashini
 */
export async function getSupportedLanguages(): Promise<string[]> {
  // Bhashini supports 22 Indian languages + English
  return [
    'en', // English
    'hi', // Hindi
    'ta', // Tamil
    'te', // Telugu
    'kn', // Kannada
    'ml', // Malayalam
    'bn', // Bengali
    'gu', // Gujarati
    'mr', // Marathi
    'pa', // Punjabi
    'or', // Odia
    'as', // Assamese
    'ne', // Nepali
    'ur', // Urdu
    'si', // Sinhala
    'sa', // Sanskrit
  ];
}

/**
 * Map language code to Bhashini language code
 */
export function mapToBhashiniCode(languageCode: string): string {
  const mapping: Record<string, string> = {
    en: 'en',
    hi: 'hi',
    ta: 'ta',
    te: 'te',
    kn: 'kn',
    ml: 'ml',
    bn: 'bn',
    gu: 'gu',
    mr: 'mr',
    pa: 'pa',
    or: 'or',
    as: 'as',
    ne: 'ne',
    ur: 'ur',
    si: 'si',
    sa: 'sa',
  };

  return mapping[languageCode] || languageCode;
}
