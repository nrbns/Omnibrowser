/**
 * Regen Real-Time WebSocket Client
 * Connects to backend and handles real-time events with strongly typed routing.
 */

import { v4 as uuidv4 } from 'uuid';
import { ipc } from '../ipc-typed';
import { getEnvVar } from '../env';

export type RegenSocketEvent =
  | RegenMessageEvent
  | RegenStatusEvent
  | RegenCommandEvent
  | RegenNotificationEvent
  | RegenErrorEvent;

export interface BaseEvent {
  id: string;
  clientId: string;
  sessionId: string;
  timestamp: number;
  version: 1;
}

export interface RegenMessageEvent extends BaseEvent {
  type: 'message';
  role: 'assistant' | 'user';
  mode: 'research' | 'trade' | 'browser' | 'automation' | 'handsFree';
  language: string;
  text: string;
  done?: boolean;
}

export interface RegenStatusEvent extends BaseEvent {
  type: 'status';
  phase: 'planning' | 'searching' | 'scraping' | 'calling_workflow' | 'executing_command' | 'idle';
  detail?: string;
}

export interface RegenCommandEvent extends BaseEvent {
  type: 'command';
  command:
    | { kind: 'OPEN_TAB'; url: string; background?: boolean }
    | { kind: 'SCROLL'; tabId: string; amount: number }
    | { kind: 'CLICK_ELEMENT'; tabId: string; elementId: string; selector?: string }
    | { kind: 'GO_BACK'; tabId: string }
    | { kind: 'GO_FORWARD'; tabId: string }
    | { kind: 'SWITCH_TAB'; tabId: string }
    | { kind: 'CLOSE_TAB'; tabId: string }
    | { kind: 'SPEAK'; text: string; language: string }
    | { kind: 'STOP_SPEAKING' }
    | { kind: 'TYPE_INTO_ELEMENT'; tabId: string; selector: string; text: string };
}

export interface RegenNotificationEvent extends BaseEvent {
  type: 'notification';
  level: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
}

export interface RegenErrorEvent extends BaseEvent {
  type: 'error';
  code: string;
  message: string;
  recoverable?: boolean;
}

export interface RegenSocketHandlers {
  onMessage?: (event: RegenMessageEvent) => void;
  onStatus?: (event: RegenStatusEvent) => void;
  onCommand?: (event: RegenCommandEvent) => void | Promise<void>;
  onNotification?: (event: RegenNotificationEvent) => void;
  onError?: (event: RegenErrorEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (event?: CloseEvent) => void;
}

export interface RegenSocketOptions {
  clientId?: string;
  sessionId?: string;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
  handlers?: Partial<RegenSocketHandlers>;
}

const noop = () => {};

const defaultHandlers: Required<RegenSocketHandlers> = {
  onMessage: noop,
  onStatus: noop,
  onCommand: async () => {
    /* no-op */
  },
  onNotification: noop,
  onError: event => {
    console.error('[RegenSocket] error', event);
  },
  onConnected: noop,
  onDisconnected: noop,
};

function resolveApiBase(): string {
  const envUrl =
    getEnvVar('VITE_REDIX_URL') ||
    getEnvVar('REDIX_URL') ||
    (typeof window !== 'undefined' ? (window as any).__REDIX_URL : undefined);
  return (envUrl || 'http://localhost:4000').replace(/\/$/, '');
}

function buildAgentStreamUrl(baseUrl: string, clientId: string, sessionId?: string) {
  const target = new URL(baseUrl);
  target.pathname = '/agent/stream';
  target.searchParams.set('clientId', clientId);
  if (sessionId) {
    target.searchParams.set('sessionId', sessionId);
  }
  if (target.protocol === 'http:') {
    target.protocol = 'ws:';
  } else if (target.protocol === 'https:') {
    target.protocol = 'wss:';
  }
  return target.toString();
}

async function executeCommand(cmd: RegenCommandEvent['command']) {
  switch (cmd.kind) {
    case 'OPEN_TAB':
      await ipc.regen.openTab({ url: cmd.url, background: cmd.background });
      break;
    case 'SCROLL':
      await ipc.regen.scroll({ tabId: cmd.tabId, amount: cmd.amount });
      break;
    case 'CLICK_ELEMENT':
      if (cmd.selector) {
        await ipc.regen.clickElement({ tabId: cmd.tabId, selector: cmd.selector });
      }
      break;
    case 'GO_BACK':
      await ipc.regen.goBack({ tabId: cmd.tabId });
      break;
    case 'GO_FORWARD':
      await ipc.regen.goForward({ tabId: cmd.tabId });
      break;
    case 'SWITCH_TAB':
      await ipc.regen.switchTab({ id: cmd.tabId });
      break;
    case 'CLOSE_TAB':
      await ipc.regen.closeTab({ tabId: cmd.tabId });
      break;
    case 'TYPE_INTO_ELEMENT':
      await ipc.regen.typeIntoElement({
        tabId: cmd.tabId,
        selector: cmd.selector,
        text: cmd.text,
      });
      break;
    case 'SPEAK':
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cmd.text);
        utterance.lang = cmd.language;
        window.speechSynthesis.speak(utterance);
      }
      break;
    case 'STOP_SPEAKING':
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      break;
  }
}

class RegenSocketClient {
  private socket: WebSocket | null = null;
  private readonly clientId: string;
  private sessionId?: string;
  private readonly autoReconnect: boolean;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelayMs: number;
  private isReconnecting = false;
  private manualClose = false;
  private handlers: Required<RegenSocketHandlers>;

  constructor(options: RegenSocketOptions = {}) {
    this.clientId = options.clientId || `client-${uuidv4()}`;
    this.sessionId = options.sessionId;
    this.autoReconnect = options.autoReconnect ?? true;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1500;
    this.handlers = {
      ...defaultHandlers,
      onCommand: async event => {
        await executeCommand(event.command);
      },
      ...(options.handlers || {}),
    } as Required<RegenSocketHandlers>;
  }

  updateHandlers(partial: Partial<RegenSocketHandlers>) {
    this.handlers = {
      ...this.handlers,
      ...partial,
    };
  }

  connect(nextSessionId?: string): Promise<void> {
    if (nextSessionId) {
      this.sessionId = nextSessionId;
    }

    return new Promise((resolve, reject) => {
      if (
        this.socket &&
        (this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING)
      ) {
        resolve();
        return;
      }

      const url = buildAgentStreamUrl(resolveApiBase(), this.clientId, this.sessionId);

      try {
        this.manualClose = false;
        this.socket = new WebSocket(url);

        const timeout = setTimeout(() => {
          if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
            this.socket.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10_000);

        this.socket.onopen = () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.handlers.onConnected();
          resolve();
        };

        this.socket.onmessage = ev => {
          try {
            const event: RegenSocketEvent = JSON.parse(ev.data);
            this.routeEvent(event);
          } catch (error) {
            console.error('[RegenSocket] Failed to parse event', error);
          }
        };

        this.socket.onerror = () => {
          clearTimeout(timeout);
          const event: RegenErrorEvent = {
            id: uuidv4(),
            clientId: this.clientId,
            sessionId: this.sessionId || '',
            timestamp: Date.now(),
            version: 1,
            type: 'error',
            code: 'WEBSOCKET_ERROR',
            message: 'WebSocket connection error',
            recoverable: true,
          };
          this.handlers.onError(event);
          reject(new Error(event.message));
        };

        this.socket.onclose = closeEvent => {
          clearTimeout(timeout);
          this.handlers.onDisconnected(closeEvent);

          if (this.manualClose || !this.autoReconnect) {
            return;
          }

          if (closeEvent.code !== 1000) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts += 1;

    setTimeout(() => {
      this.connect(this.sessionId).catch(() => {
        this.isReconnecting = false;
      });
    }, this.reconnectDelayMs * this.reconnectAttempts);
  }

  private routeEvent(event: RegenSocketEvent) {
    switch (event.type) {
      case 'message':
        this.handlers.onMessage(event);
        break;
      case 'status':
        this.handlers.onStatus(event);
        break;
      case 'notification':
        this.handlers.onNotification(event);
        break;
      case 'error':
        this.handlers.onError(event);
        break;
      case 'command':
        Promise.resolve(this.handlers.onCommand(event)).catch(error => {
          console.error('[RegenSocket] command handler failed', error);
        });
        break;
    }
  }

  send(message: Record<string, unknown>) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }
    console.warn('[RegenSocket] Cannot send message, socket not open');
  }

  disconnect() {
    if (this.socket) {
      this.manualClose = true;
      this.socket.close(1000, 'client_closed');
      this.socket = null;
    }
  }

  getClientId(): string {
    return this.clientId;
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

export function createRegenSocket(options?: RegenSocketOptions) {
  return new RegenSocketClient(options);
}

let socketInstance: RegenSocketClient | null = null;

export function getRegenSocket(options?: string | RegenSocketOptions) {
  if (!socketInstance) {
    socketInstance =
      typeof options === 'string'
        ? new RegenSocketClient({ clientId: options })
        : new RegenSocketClient(options);
  } else if (options && typeof options === 'object') {
    socketInstance.updateHandlers(options.handlers ?? {});
  }
  return socketInstance;
}

export function connectRegenSocket(sessionId?: string, handlers?: Partial<RegenSocketHandlers>) {
  const socket = getRegenSocket({ sessionId, handlers });
  return socket.connect(sessionId);
}

export default RegenSocketClient;
