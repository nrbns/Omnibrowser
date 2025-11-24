/**
 * Shared event contract between the Regen backend and renderer.
 * These types intentionally contain only serializable fields so
 * they can travel through Redis pub/sub and WebSockets without
 * additional transforms.
 */

export type RegenEventType = 'message' | 'status' | 'command' | 'notification' | 'error';

export type RegenRole = 'agent' | 'user' | 'system' | 'tool';

export type RegenCommandType =
  | 'OPEN_TAB'
  | 'SWITCH_TAB'
  | 'SCROLL'
  | 'CLICK_ELEMENT'
  | 'NAVIGATE'
  | 'GET_DOM'
  | 'SET_FOCUS'
  | 'SPEAK';

export type RegenStatusPhase = 'planning' | 'thinking' | 'executing' | 'waiting' | 'streaming' | 'idle';

export type RegenNotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface RegenSocketEventBase {
  clientId: string;
  type: RegenEventType;
  timestamp: number;
  requestId?: string;
  mode?: 'research' | 'trade' | 'browser' | 'automation';
}

export interface RegenMessageEvent extends RegenSocketEventBase {
  type: 'message';
  messageId: string;
  role: RegenRole;
  text: string;
  stream?: boolean;
  done?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RegenStatusEvent extends RegenSocketEventBase {
  type: 'status';
  phase: RegenStatusPhase;
  label?: string;
  detail?: string;
  progress?: number; // 0 - 1
}

export interface RegenCommandPayload {
  tabId?: string;
  url?: string;
  amount?: number;
  elementId?: string;
  selector?: string;
  text?: string;
  direction?: 'up' | 'down';
  extra?: Record<string, unknown>;
}

export interface RegenCommandEvent extends RegenSocketEventBase {
  type: 'command';
  command: RegenCommandType;
  payload?: RegenCommandPayload;
}

export interface RegenNotificationEvent extends RegenSocketEventBase {
  type: 'notification';
  notificationId: string;
  severity: RegenNotificationSeverity;
  title: string;
  body: string;
  actionUrl?: string;
  meta?: Record<string, unknown>;
}

export interface RegenErrorEvent extends RegenSocketEventBase {
  type: 'error';
  code: string;
  message: string;
  retryable?: boolean;
  detail?: string;
}

export type RegenSocketEvent =
  | RegenMessageEvent
  | RegenStatusEvent
  | RegenCommandEvent
  | RegenNotificationEvent
  | RegenErrorEvent;

export const REGEN_SOCKET_EVENT_VERSION = 1;

export const RegenCommandCatalog: Record<RegenCommandType, RegenCommandType> = {
  OPEN_TAB: 'OPEN_TAB',
  SWITCH_TAB: 'SWITCH_TAB',
  SCROLL: 'SCROLL',
  CLICK_ELEMENT: 'CLICK_ELEMENT',
  NAVIGATE: 'NAVIGATE',
  GET_DOM: 'GET_DOM',
  SET_FOCUS: 'SET_FOCUS',
  SPEAK: 'SPEAK',
};

export function isRegenSocketEvent(value: unknown): value is RegenSocketEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<RegenSocketEvent>;
  if (!candidate.clientId || typeof candidate.clientId !== 'string') {
    return false;
  }
  if (!candidate.type) {
    return false;
  }
  if (typeof candidate.timestamp !== 'number') {
    return false;
  }
  return true;
}
