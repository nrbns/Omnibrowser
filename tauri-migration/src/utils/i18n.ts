type VoiceTranslationKey =
  | 'voice_listening'
  | 'voice_ready'
  | 'voice_no_speech'
  | 'voice_permission_denied'
  | 'voice_error';

type TranslationEntry = Record<VoiceTranslationKey, string>;

const EN_TRANSLATIONS: TranslationEntry = {
  voice_listening: 'Listening… speak now',
  voice_ready: 'Voice input ready',
  voice_no_speech: 'No speech detected. Please try again.',
  voice_permission_denied: 'Microphone permission denied. Enable mic access to continue.',
  voice_error: 'Speech recognition failed. Please try again.',
};

const HI_TRANSLATIONS: TranslationEntry = {
  voice_listening: 'सुन रहे हैं… अब बोलें',
  voice_ready: 'आवाज़ समझ ली गई',
  voice_no_speech: 'आवाज़ नहीं मिली। दोबारा बोलें।',
  voice_permission_denied: 'माइक्रोफोन की अनुमति नहीं मिली। कृपया अनुमति दें।',
  voice_error: 'आवाज़ पहचान विफल रही। कृपया दोबारा प्रयास करें।',
};

const TA_TRANSLATIONS: TranslationEntry = {
  voice_listening: 'விநாடியில் கேட்கிறோம்… பேசுங்கள்',
  voice_ready: 'குரல் பதிவு முடிந்தது',
  voice_no_speech: 'ஒலி கண்டறியப்படவில்லை. மறுபடியும் முயற்சிக்கவும்.',
  voice_permission_denied: 'மைக்ரோபோன் அனுமதி இல்லை. அனுமதி வழங்கவும்.',
  voice_error: 'குரல் அடையாளம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
};

const BN_TRANSLATIONS: TranslationEntry = {
  voice_listening: 'শুনছি… এখন বলুন',
  voice_ready: 'আপনার কণ্ঠ ধরা হয়েছে',
  voice_no_speech: 'কোনও কথা শোনা যায়নি। আবার চেষ্টা করুন।',
  voice_permission_denied: 'মাইক্রোফোনের অনুমতি নেই। অনুগ্রহ করে অনুমতি দিন।',
  voice_error: 'ভয়েস শনাক্তকরণ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।',
};

const TRANSLATIONS: Record<string, TranslationEntry> = {
  en: EN_TRANSLATIONS,
  hi: HI_TRANSLATIONS,
  ta: TA_TRANSLATIONS,
  bn: BN_TRANSLATIONS,
};

export function tVoice(key: VoiceTranslationKey, language?: string) {
  if (!language) return EN_TRANSLATIONS[key];
  if (TRANSLATIONS[language]) return TRANSLATIONS[language][key];

  // Fallback to English for unsupported languages
  return EN_TRANSLATIONS[key];
}
