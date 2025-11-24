/**
 * Hands-Free Mode Component
 * Continuous voice listening + TTS responses
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, Wifi, WifiOff } from 'lucide-react';
import { toast } from '../../utils/toast';
import { createRegenRealtimeClient } from '../../regen/realtime';
import type {
  RegenCommandEvent,
  RegenErrorEvent,
  RegenMessageEvent,
  RegenStatusEvent,
} from '../../../shared/regen-events';
import { nanoid } from '../../core/utils/nanoid';

interface HandsFreeModeProps {
  sessionId: string;
  mode: 'research' | 'trade';
  onCommand?: (command: { type: string; payload: any }) => void;
  onClose?: () => void;
}

export function HandsFreeMode({ sessionId, mode, onCommand, onClose }: HandsFreeModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [socketReady, setSocketReady] = useState(false);
  const clientIdRef = useRef<string>(`regen-handsfree-${nanoid(10)}`);
  const clientId = clientIdRef.current;
  const responseBufferRef = useRef<Record<string, string>>({});

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Continuous listening
      recognition.interimResults = false;
      recognition.lang = 'en-US,ta-IN,hi-IN'; // Support multiple languages

      recognition.onresult = async (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0]?.transcript)
          .join(' ')
          .trim();

        if (transcript && !isProcessing) {
          setIsProcessing(true);
          await handleVoiceCommand(transcript);
          setIsProcessing(false);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          toast.error('Voice recognition error. Please try again.');
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Auto-restart if hands-free mode is still on
        if (isListening && !isProcessing) {
          try {
            recognition.start();
          } catch {
            // Already started or other error
          }
        }
      };

      recognitionRef.current = recognition;
    }

    synthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [isListening, isProcessing]);

  const handleSocketMessage = useCallback((event: RegenMessageEvent) => {
    if (!event?.text) return;
    responseBufferRef.current[event.messageId] = responseBufferRef.current[event.messageId]
      ? `${responseBufferRef.current[event.messageId]} ${event.text}`.trim()
      : event.text;
    if (event.done && ttsEnabled) {
      speak(responseBufferRef.current[event.messageId]);
      delete responseBufferRef.current[event.messageId];
    }
  }, [ttsEnabled]);

  const handleStatusEvent = useCallback((event: RegenStatusEvent) => {
    if (event.phase === 'idle') {
      setIsProcessing(false);
    } else if (event.phase !== 'planning') {
      setIsProcessing(true);
    }
  }, []);

  const handleCommand = useCallback(
    (event: RegenCommandEvent) => {
      if (event.command && onCommand) {
        onCommand({ type: event.command, payload: event.payload ?? {} });
      }
    },
    [onCommand]
  );

  const handleStreamError = useCallback(
    (event: RegenErrorEvent) => {
      toast.error(event.message);
      setIsProcessing(false);
    },
    []
  );

  useEffect(() => {
    const client = createRegenRealtimeClient(clientId, {
      onOpen: () => setSocketReady(true),
      onClose: () => setSocketReady(false),
      onMessage: handleSocketMessage,
      onStatus: handleStatusEvent,
      onCommand: handleCommand,
      onStreamError: handleStreamError,
      onError: () => setSocketReady(false),
    });
    client.connect();
    return () => client.disconnect();
  }, [clientId, handleSocketMessage, handleStatusEvent, handleCommand, handleStreamError]);

  const handleVoiceCommand = async (transcript: string) => {
    // Stop command
    if (transcript.toLowerCase().includes('stop') || transcript.toLowerCase().includes('cancel')) {
      speak('Stopped hands-free actions.');
      return;
    }

    if (!socketReady) {
      toast.error('Regen connection unavailable. Please wait a moment.');
      return;
    }

    try {
      const response = await fetch('http://localhost:4000/api/agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          sessionId,
          message: transcript,
          mode,
          source: 'voice',
          locale: navigator.language || 'en',
        }),
      });
      if (!response.ok) {
        throw new Error('Voice query failed');
      }
    } catch (error) {
      console.error('[HandsFree] Command failed:', error);
      speak('Sorry, I encountered an error. Please try again.');
    }
  };

  const speak = (text: string) => {
    if (!synthRef.current || !ttsEnabled) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; // Can be made language-aware
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    synthRef.current.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Voice recognition not available in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        speak("Hands-free mode activated. I'm listening...");
      } catch (error) {
        console.error('Failed to start recognition:', error);
        toast.error('Failed to start voice recognition');
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Controls */}
      <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-lg">
        {socketReady ? (
          <Wifi className="w-4 h-4 text-green-400" aria-label="Connected" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-400" aria-label="Disconnected" />
        )}
        <button
          onClick={() => setTtsEnabled(!ttsEnabled)}
          className={`p-2 rounded transition-colors ${
            ttsEnabled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
          aria-label={ttsEnabled ? 'Disable TTS' : 'Enable TTS'}
        >
          {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleListening}
          className={`p-3 rounded-full transition-colors ${
            isListening
              ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status indicator */}
      {isListening && (
        <div className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
          {isProcessing ? 'Processing...' : 'Listening...'}
        </div>
      )}
    </div>
  );
}
