import { useEffect, useRef, useState } from 'react';
import { toast } from '../utils/toast';
import { triggerHaptic } from '../utils/haptic';
import { useSettingsStore } from '../state/settingsStore';
import { useLanguageState, getActiveLanguage } from '../state/languageState';
import { detectLanguage } from '../services/languageDetection';
import { getLanguageMeta } from '../constants/languageMeta';
import { tVoice } from '../utils/i18n';

type Props = { onResult: (text: string) => void; small?: boolean };

const LOCALE_MAP: Record<string, string> = {
  hi: 'hi-IN',
  ta: 'ta-IN',
  bn: 'bn-IN',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
};

const resolveLocale = (language: string) =>
  LOCALE_MAP[language] || `${language}-${language.toUpperCase()}`;

export default function VoiceButton({ onResult, small }: Props) {
  const [active, setActive] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [waveHeights, setWaveHeights] = useState([6, 12, 18]);
  const recogRef = useRef<any>(null);
  const languagePreference = useSettingsStore(state => state.language || 'auto');
  const detectedLanguage = useLanguageState(state => state.detectedLanguage);
  const setDetectedLanguage = useLanguageState(state => state.setDetectedLanguage);
  const activeLanguage = getActiveLanguage(languagePreference, detectedLanguage);
  const meta = getLanguageMeta(activeLanguage);

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      try {
        const r = new SR();
        r.continuous = false;
        r.interimResults = false;
        r.lang = resolveLocale(activeLanguage);
        r.onresult = async (e: any) => {
          try {
            const results = Array.isArray(e.results) ? Array.from(e.results) : [];
            const transcripts = results
              .map((res: any) => res?.[0]?.transcript)
              .filter((t: any) => t && typeof t === 'string');
            const t = transcripts.join(' ').trim();
            if (t) {
              try {
                const detection = await detectLanguage(t);
                setDetectedLanguage(detection.language, detection.confidence, detection.method);
              } catch (error) {
                console.warn('[VoiceButton] Failed to auto-detect language', error);
              }
              toast.success(tVoice('voice_ready', activeLanguage));
              onResult(t);
            }
            setActive(false);
          } catch (error) {
            console.error('[VoiceButton] Error processing speech result:', error);
            setActive(false);
            toast.error(tVoice('voice_error', activeLanguage));
          }
        };
        r.onerror = (e: any) => {
          console.error('[VoiceButton] Speech recognition error:', e.error);
          setActive(false);
          if (e.error === 'not-allowed') {
            toast.error(tVoice('voice_permission_denied', activeLanguage));
          } else if (e.error === 'no-speech') {
            toast.error(tVoice('voice_no_speech', activeLanguage));
          } else {
            toast.error(tVoice('voice_error', activeLanguage));
          }
        };
        r.onend = () => setActive(false);
        recogRef.current = r;
        setIsAvailable(true);
      } catch (error) {
        console.error('[VoiceButton] Failed to initialize speech recognition:', error);
        setIsAvailable(false);
      }
    } else {
      setIsAvailable(false);
    }
  }, [onResult, activeLanguage]);

  useEffect(() => {
    if (recogRef.current) {
      recogRef.current.lang = resolveLocale(activeLanguage);
    }
  }, [activeLanguage]);

  useEffect(() => {
    if (!active) {
      setWaveHeights([6, 12, 18]);
      return;
    }
    const interval = setInterval(() => {
      setWaveHeights(prev => prev.map(() => 6 + Math.random() * 16));
    }, 140);
    return () => clearInterval(interval);
  }, [active]);

  const start = async () => {
    const SR: any = recogRef.current;
    if (!SR || !isAvailable) {
      toast.error(
        'Speech recognition is not available in this browser. Please use a supported browser like Chrome or Edge.'
      );
      return;
    }
    try {
      setActive(true);
      await triggerHaptic('medium');
      toast.info(tVoice('voice_listening', activeLanguage));
      SR.start();
    } catch (error: any) {
      console.error('[VoiceButton] Failed to start recognition:', error);
      setActive(false);
      toast.error(tVoice('voice_error', activeLanguage));
    }
  };

  return (
    <button
      type="button"
      data-tour="voice"
      className={`${
        small ? 'px-3 py-2' : 'px-4 py-2'
      } flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition`}
      onClick={start}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      }}
      aria-label={active ? 'Stop voice recognition' : 'Start voice search'}
      aria-pressed={active}
    >
      <div className="flex h-5 items-end gap-1" aria-hidden="true">
        {waveHeights.map((height, idx) => (
          <span
            key={idx}
            className="w-1 rounded-full"
            style={{
              height: `${height}px`,
              opacity: active ? 1 : 0.4,
              background: `linear-gradient(180deg, ${meta.gradient[0]}, ${meta.gradient[1]})`,
            }}
          />
        ))}
      </div>
      <span className="text-sm text-slate-100">
        {active ? tVoice('voice_listening', activeLanguage) : meta.nativeName}
      </span>
    </button>
  );
}
