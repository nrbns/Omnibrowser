/**
 * Quick Tour - 3-Step Onboarding (Day 6)
 * Simplified Joyride-based tour for first-time users
 */

import { useState, useEffect, useCallback } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS, Step, CallBackProps } from 'react-joyride';
import { useOnboardingStore } from '../../state/onboardingStore';

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="voice"]',
    content: (
      <div>
        <h3 className="text-lg font-bold text-white mb-2">🎤 Voice Commands</h3>
        <p className="text-sm text-gray-300 mb-2">
          Click the mic button or say <strong>"Nifty chart"</strong> in Hindi/Tamil/Bengali.
          RegenBrowser auto-detects your language and responds.
        </p>
        <p className="text-xs text-gray-400">
          Supports 100+ languages including all 22 Indic languages!
        </p>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="trade"]',
    content: (
      <div>
        <h3 className="text-lg font-bold text-white mb-2">📈 Trade Mode</h3>
        <p className="text-sm text-gray-300 mb-2">
          Switch to Trade mode for live NSE charts, real-time Nifty ticks, and Zerodha-style order
          entry.
        </p>
        <p className="text-xs text-gray-400">
          Live data powered by Finnhub WebSocket + Yahoo Finance historical candles.
        </p>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="research"]',
    content: (
      <div>
        <h3 className="text-lg font-bold text-white mb-2">🔍 Research Mode</h3>
        <p className="text-sm text-gray-300 mb-2">
          Ask questions in any language. Get streaming answers with source cards, citations, and
          follow-up suggestions—like Perplexity Pro.
        </p>
        <p className="text-xs text-gray-400">
          Try: "Explain quantum computing basics" or "Summarize today's markets"
        </p>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: true,
  },
];

export function QuickTour() {
  const { visible, finish } = useOnboardingStore();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Wait a bit for DOM to be ready
    const timer = setTimeout(() => {
      if (visible) {
        setRun(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, action, index, type } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
        setRun(false);
        finish();
        return;
      }

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
        if (nextStepIndex < TOUR_STEPS.length) {
          setStepIndex(nextStepIndex);
        } else {
          setRun(false);
          finish();
        }
      }
    },
    [finish]
  );

  if (!visible || !run) return null;

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#8b5cf6',
          textColor: '#e2e8f0',
          backgroundColor: '#1e293b',
          overlayColor: 'rgba(0, 0, 0, 0.7)',
          arrowColor: '#1e293b',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 20,
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonNext: {
          backgroundColor: '#8b5cf6',
          color: 'white',
          borderRadius: 8,
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 600,
          outline: 'none',
        },
        buttonBack: {
          color: '#94a3b8',
          marginRight: 10,
        },
        buttonSkip: {
          color: '#64748b',
        },
        spotlight: {
          borderRadius: 8,
        },
      }}
      locale={{
        back: 'Previous',
        close: 'Skip Tour',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip',
      }}
    />
  );
}
