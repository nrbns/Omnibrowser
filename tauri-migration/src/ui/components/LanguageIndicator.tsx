import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../../state/settingsStore';
import { useLanguageState, getActiveLanguage } from '../../state/languageState';
import { getLanguageMeta, LANGUAGE_OPTIONS } from '../../constants/languageMeta';

type LanguageIndicatorProps = {
  compact?: boolean;
};

export function LanguageIndicator({ compact }: LanguageIndicatorProps) {
  const [open, setOpen] = useState(false);
  const languagePreference = useSettingsStore(state => state.language || 'auto');
  const setLanguage = useSettingsStore(state => state.setLanguage);
  const detectedLanguage = useLanguageState(state => state.detectedLanguage);
  const detectedConfidence = useLanguageState(state => state.detectedConfidence);
  const detectedMethod = useLanguageState(state => state.detectedMethod);

  const activeLanguage = getActiveLanguage(languagePreference, detectedLanguage);
  const meta = getLanguageMeta(activeLanguage);
  const isAuto = languagePreference === 'auto';

  const confidenceLabel = isAuto ? `Auto (${Math.round(detectedConfidence * 100)}%)` : 'Manual';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="text-lg" aria-hidden="true">
          {meta.flag}
        </span>
        {!compact && (
          <span className="flex flex-col text-left leading-tight">
            <span className="text-slate-100">{meta.nativeName}</span>
            <span className="text-[10px] text-slate-400">{confidenceLabel}</span>
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-800/80 bg-slate-900/95 p-2 shadow-2xl">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Voice & UI language
          </div>
          <div className="space-y-1">
            {LANGUAGE_OPTIONS.map(option => (
              <button
                key={option.code}
                onClick={() => {
                  setLanguage(option.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  languagePreference === option.code
                    ? 'bg-indigo-500/20 text-indigo-100'
                    : 'text-slate-200 hover:bg-slate-800/70'
                }`}
              >
                <span className="text-lg" aria-hidden="true">
                  {option.flag}
                </span>
                <span className="flex-1 text-left">{option.label}</span>
              </button>
            ))}
          </div>
          {isAuto && (
            <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
              <div className="font-semibold text-slate-200">Auto-detected</div>
              <div className="text-xs text-slate-400">
                {meta.nativeName} · {(detectedConfidence * 100).toFixed(0)}% ({detectedMethod})
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
