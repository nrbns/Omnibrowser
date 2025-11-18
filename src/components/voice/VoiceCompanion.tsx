/**
 * Voice Companion - Hands-free AI assistant with Redix integration
 * 
 * Features:
 * - Always listening toggle (wake word or button)
 * - Context-aware (current tab, selected text)
 * - Proactive suggestions
 * - Natural TTS output
 * - Eco-aware (battery/memory checks)
 * - Privacy-first (local Ollama fallback)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, VolumeX, Battery, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabsStore } from '../../state/tabsStore';
// import { ipc } from '../../lib/ipc-typed'; // Unused for now

// Redix core URL
const REDIX_CORE_URL = import.meta.env.VITE_REDIX_CORE_URL || 'http://localhost:8001';

// Speech Recognition types (not in standard DOM types)
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: any) => any) | null;
  onerror: ((this: SpeechRecognition, ev: any) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface _SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface _SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface VoiceCompanionProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right';
  compact?: boolean;
}

export default function VoiceCompanion({ position = 'bottom-right', compact: _compact = false }: VoiceCompanionProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ecoScore, setEcoScore] = useState<number | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const activeTab = useTabsStore((state) => {
    if (!state.activeId) return null;
    return state.tabs.find((t) => t.id === state.activeId) || null;
  });

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech Recognition not available in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as SpeechRecognitionResultList)
        .map((result: SpeechRecognitionResult) => result[0]?.transcript || '')
        .join(' ');
      setTranscript(transcript);

      const lastResult = event.results[event.results.length - 1] as SpeechRecognitionResult;
      if (lastResult?.isFinal) {
        handleVoiceCommand(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[VoiceCompanion] Recognition error:', event.error);
      if (event.error === 'no-speech') {
        setError('No speech detected. Try again.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone permission denied. Please enable in browser settings.');
      } else {
        setError(`Recognition error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    synthesisRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, []);

  // Battery monitoring
  useEffect(() => {
    const checkBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          setBatteryLevel(battery.level);
          
          const updateBattery = () => setBatteryLevel(battery.level);
          battery.addEventListener('chargingchange', updateBattery);
          battery.addEventListener('levelchange', updateBattery);
          
          return () => {
            battery.removeEventListener('chargingchange', updateBattery);
            battery.removeEventListener('levelchange', updateBattery);
          };
        }
      } catch (error) {
        console.debug('[VoiceCompanion] Battery API not available:', error);
      }
    };

    checkBattery();
  }, []);

  // Handle voice command
  const handleVoiceCommand = useCallback(async (transcript: string) => {
    try {
      // Get current tab context
      const url = activeTab?.url;
      const title = activeTab?.title;
      
      // Get selected text (would need IPC in Electron)
      let selection = '';
      try {
        if (typeof window !== 'undefined' && window.getSelection) {
          selection = window.getSelection()?.toString() || '';
        }
      } catch {
        // Ignore
      }

      // Send to Redix /voice endpoint
      const response = await fetch(`${REDIX_CORE_URL}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          url,
          title,
          selection,
          tabId: activeTab?.id,
          context: {
            batteryLevel: batteryLevel ?? undefined,
            memoryUsage: (performance as any).memory?.usedJSHeapSize 
              ? (performance as any).memory.usedJSHeapSize / (1024 * 1024) 
              : undefined,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Voice API error: ${response.statusText}`);
      }

      const data = await response.json();
      setResponse(data.response || 'No response');
      setEcoScore(data.ecoScore || null);

      // Speak the response
      if (data.response && data.action !== 'none') {
        speak(data.response);
      }

      // Handle actions
      if (data.action === 'search' && transcript) {
        // Could trigger search in SearchBar
        console.debug('[VoiceCompanion] Search action:', transcript);
      } else if (data.action === 'summarize' && url) {
        // Could trigger page summarization
        console.debug('[VoiceCompanion] Summarize action:', url);
      } else if (data.action === 'note' && transcript) {
        // Could save to Notes sidebar
        console.debug('[VoiceCompanion] Note action:', transcript);
      }
    } catch (error: any) {
      console.error('[VoiceCompanion] Voice command failed:', error);
      setError(error.message || 'Failed to process voice command');
      setResponse('Sorry, I encountered an error. Please try again.');
    }
  }, [activeTab, batteryLevel]);

  // Speak text
  const speak = useCallback((text: string) => {
    if (!synthesisRef.current) return;

    // Cancel any ongoing speech
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthesisRef.current.speak(utterance);
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech Recognition not available.');
      return;
    }

    // Check battery level
    if (batteryLevel !== null && batteryLevel < 0.3 && !listening) {
      setError('Battery low (<30%). Voice paused to save power.');
      speak('Battery low. Voice paused to save power.');
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      setTranscript('');
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
        setError(null);
        setResponse('');
      } catch (error: any) {
        console.error('[VoiceCompanion] Failed to start recognition:', error);
        setError('Failed to start listening. Please try again.');
      }
    }
  }, [listening, batteryLevel, speak]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
  };

  const isLowBattery = batteryLevel !== null && batteryLevel < 0.3;

  return (
    <div className={`fixed ${positionClasses[position]} z-50 flex flex-col items-end gap-2`}>
      {/* Main Voice Orb */}
      <motion.button
        onClick={toggleListening}
        disabled={isLowBattery && !listening}
        className={`
          relative p-4 rounded-full shadow-2xl transition-all
          ${listening 
            ? 'bg-red-500 hover:bg-red-600' 
            : isLowBattery
            ? 'bg-gray-600 cursor-not-allowed opacity-50'
            : 'bg-purple-600 hover:bg-purple-700'
          }
          focus:outline-none focus:ring-2 focus:ring-purple-400/50
        `}
        animate={{
          scale: listening ? [1, 1.1, 1] : 1,
        }}
        transition={{
          duration: 1.5,
          repeat: listening ? Infinity : 0,
          ease: 'easeInOut',
        }}
        title={listening ? 'Stop listening' : isLowBattery ? 'Battery low - Voice paused' : 'Start listening'}
      >
        {listening ? (
          <MicOff className="w-6 h-6 text-white" />
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
        
        {/* Pulsing ring when listening */}
        {listening && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-400"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.8, 0, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </motion.button>

      {/* Battery indicator */}
      {batteryLevel !== null && (
        <div className={`flex items-center gap-1 text-xs ${isLowBattery ? 'text-amber-400' : 'text-gray-400'}`}>
          <Battery className="w-3 h-3" />
          <span>{Math.round(batteryLevel * 100)}%</span>
        </div>
      )}

      {/* Transcript/Response Bubbles */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-xs p-3 bg-gray-800/95 text-white text-sm rounded-lg shadow-lg border border-gray-700"
          >
            <div className="font-semibold text-purple-300 mb-1">You:</div>
            <div>{transcript}</div>
          </motion.div>
        )}

        {response && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-xs p-3 bg-green-700/95 text-white text-sm rounded-lg shadow-lg border border-green-600"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-green-200">Regen:</div>
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="p-1 hover:bg-green-600 rounded"
                  title="Stop speaking"
                >
                  <VolumeX className="w-3 h-3" />
                </button>
              )}
            </div>
            <div>{response}</div>
            {ecoScore !== null && (
              <div className="mt-2 text-xs text-green-300">
                Eco Score: {ecoScore}%
              </div>
            )}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-xs p-3 bg-red-700/95 text-white text-sm rounded-lg shadow-lg border border-red-600 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

