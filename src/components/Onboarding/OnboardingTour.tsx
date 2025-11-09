import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to OmniBrowser × Redix',
    description:
      'This browser is built for agentic research. Let’s take a 30-second tour of the core controls and regenerative superpowers.',
  },
  {
    id: 'omnibox',
    title: 'Omnibox with @live AI',
    description:
      'Press ⌘/Ctrl + L to focus the omnibox. Try typing “@live quantum trends” to stream Redix results and graphs in real time.',
    target: '[data-onboarding="omnibox"]',
  },
  {
    id: 'tabstrip',
    title: 'Smart Tab Strip',
    description:
      'Tabs show peek previews, mode badges, and hibernation state. Scroll horizontally or hit Ctrl+Tab to jump quickly.',
    target: '[data-onboarding="tabstrip"]',
  },
  {
    id: 'regen',
    title: 'Regenerative Efficiency',
    description:
      'When the battery dips, Redix predicts remaining time, throttles background tabs, and offers +1.8 hr boost actions.',
    target: '[data-onboarding="status-bar"]',
  },
  {
    id: 'graph',
    title: 'Tab DNA Graph',
    description:
      'Press ⌘/Ctrl + Shift + G to open the live tab graph. You’ll see domains, containers, and session affinity mapped instantly.',
  },
  {
    id: 'consent',
    title: 'Ethical Control',
    description:
      'Every AI action requests consent in the ledger. Review what Redix can remember, approve, or revoke at any time.',
  },
];

interface Spotlight {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);

  const step = useMemo(() => STEPS[index], [index]);

  useEffect(() => {
    if (!step?.target) {
      setSpotlight(null);
      return;
    }
    const element = document.querySelector(step.target) as HTMLElement | null;
    if (!element) {
      setSpotlight(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    setSpotlight({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    });
  }, [step]);

  const goNext = () => {
    if (index < STEPS.length - 1) {
      setIndex((current) => current + 1);
    } else {
      onClose();
    }
  };

  const goBack = () => {
    setIndex((current) => Math.max(0, current - 1));
  };

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        {spotlight && (
          <div
            className="pointer-events-none absolute rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
            style={{
              top: spotlight.top - 8,
              left: spotlight.left - 8,
              width: spotlight.width + 16,
              height: spotlight.height + 16,
              transition: 'all 0.25s ease',
            }}
          />
        )}

        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-[min(460px,90vw)] rounded-3xl border border-slate-700/70 bg-slate-950/95 p-6 text-gray-100 shadow-2xl"
        >
          <button
            className="absolute right-5 top-5 rounded-full border border-slate-700/60 bg-slate-900/70 p-1.5 text-gray-400 hover:text-gray-200"
            onClick={onClose}
            aria-label="Skip onboarding"
          >
            <X size={16} />
          </button>

          <div className="text-xs uppercase tracking-wide text-emerald-300/80">Step {index + 1} of {STEPS.length}</div>
          <h2 className="mt-2 text-xl font-semibold text-white">{step.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-300">{step.description}</p>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              onClick={goBack}
              disabled={index === 0}
              className="rounded-lg border border-slate-700/60 px-3 py-2 text-gray-300 hover:border-slate-500/80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700/60 px-3 py-2 text-gray-400 hover:text-gray-200"
              >
                Skip
              </button>
              <button
                onClick={goNext}
                className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 font-medium text-emerald-100 hover:bg-emerald-500/20"
              >
                {index === STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
