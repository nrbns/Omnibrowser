import { create } from 'zustand';
import {
  type RegenMessageEvent,
  type RegenNotificationEvent,
  type RegenStatusEvent,
} from '../lib/realtime/regen-socket';

export interface RegenChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
  mode?: RegenMessageEvent['mode'];
  language?: string;
  done?: boolean;
  commands?: Array<{ type: string; payload: Record<string, unknown> }>;
}

export interface RegenChatState {
  messages: RegenChatMessage[];
  status?: RegenStatusEvent;
  connected: boolean;
  notifications: RegenNotificationEvent[];
  error?: string;
  activeAssistantMessageId?: string;
  appendLocalMessage: (message: RegenChatMessage) => void;
  addSystemMessage: (content: string) => void;
  upsertAssistantMessage: (event: RegenMessageEvent) => void;
  setStatus: (status: RegenStatusEvent) => void;
  addNotification: (event: RegenNotificationEvent) => void;
  setConnected: (connected: boolean) => void;
  setError: (error?: string) => void;
  reset: () => void;
}

function createAssistantMessageId(timestamp: number) {
  return `assistant-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useRegenChatStore = create<RegenChatState>(set => ({
  messages: [],
  connected: false,
  notifications: [],
  activeAssistantMessageId: undefined,
  appendLocalMessage: message =>
    set(state => ({
      messages: [...state.messages, message],
    })),
  addSystemMessage: content =>
    set(state => ({
      messages: [
        ...state.messages,
        {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: Date.now(),
          done: true,
        },
      ],
    })),
  upsertAssistantMessage: event =>
    set(state => {
      if (event.role === 'user') {
        return {
          messages: [
            ...state.messages,
            {
              id: event.id,
              role: 'user',
              content: event.text ?? '',
              timestamp: event.timestamp,
              mode: event.mode,
              language: event.language,
              done: event.done ?? true,
            },
          ],
          activeAssistantMessageId: state.activeAssistantMessageId,
        };
      }

      const nextMessages = [...state.messages];
      const chunk = event.text ?? '';
      let targetId = state.activeAssistantMessageId;

      if (!targetId) {
        targetId = createAssistantMessageId(event.timestamp);
        nextMessages.push({
          id: targetId,
          role: event.role,
          content: chunk,
          timestamp: event.timestamp,
          mode: event.mode,
          language: event.language,
          done: event.done ?? false,
        });
      } else {
        const idx = nextMessages.findIndex(msg => msg.id === targetId);
        if (idx >= 0) {
          const existing = nextMessages[idx];
          nextMessages[idx] = {
            ...existing,
            content: existing.content + chunk,
            timestamp: event.timestamp,
            mode: event.mode ?? existing.mode,
            language: event.language ?? existing.language,
            done: event.done ?? existing.done,
          };
        } else {
          // If we somehow lost the active message, create a new one
          nextMessages.push({
            id: targetId,
            role: event.role,
            content: chunk,
            timestamp: event.timestamp,
            mode: event.mode,
            language: event.language,
            done: event.done ?? false,
          });
        }
      }

      return {
        messages: nextMessages,
        activeAssistantMessageId: event.done ? undefined : targetId,
      };
    }),
  setStatus: status =>
    set({
      status,
    }),
  addNotification: notification =>
    set(state => ({
      notifications: [...state.notifications, notification],
    })),
  setConnected: connected =>
    set({
      connected,
    }),
  setError: error =>
    set({
      error: error || undefined,
    }),
  reset: () =>
    set({
      messages: [],
      status: undefined,
      connected: false,
      notifications: [],
      error: undefined,
      activeAssistantMessageId: undefined,
    }),
}));
