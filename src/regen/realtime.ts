import type {
  RegenCommandEvent,
  RegenErrorEvent,
  RegenMessageEvent,
  RegenNotificationEvent,
  RegenSocketEvent,
  RegenStatusEvent,
} from '../../shared/regen-events';

export type RegenRealtimeHandlers = {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onEvent?: (event: RegenSocketEvent) => void;
  onMessage?: (event: RegenMessageEvent) => void;
  onStatus?: (event: RegenStatusEvent) => void;
  onCommand?: (event: RegenCommandEvent) => void;
  onNotification?: (event: RegenNotificationEvent) => void;
  onStreamError?: (event: RegenErrorEvent) => void;
};

export type RegenRealtimeOptions = {
  baseUrl?: string;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
};

function resolveSocketUrl(baseUrl: string, clientId: string) {
  if (baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')) {
    return `${baseUrl}?clientId=${encodeURIComponent(clientId)}`;
  }
  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.set('clientId', clientId);
  if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  }
  return url.toString();
}

export class RegenRealtimeClient {
  private readonly clientId: string;
  private readonly handlers: RegenRealtimeHandlers;
  private readonly options: Required<RegenRealtimeOptions>;
  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private closedManually = false;

  constructor(clientId: string, handlers: RegenRealtimeHandlers = {}, options: RegenRealtimeOptions = {}) {
    if (!clientId) {
      throw new Error('RegenRealtimeClient requires a clientId');
    }
    this.clientId = clientId;
    this.handlers = handlers;
    this.options = {
      baseUrl: options.baseUrl || '/agent/stream',
      autoReconnect: options.autoReconnect ?? true,
      reconnectDelayMs: options.reconnectDelayMs ?? 2000,
      maxReconnectDelayMs: options.maxReconnectDelayMs ?? 10000,
    };
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.closedManually = false;
    const socketUrl = resolveSocketUrl(this.options.baseUrl, this.clientId);
    this.socket = new WebSocket(socketUrl);
    this.socket.addEventListener('open', this.handleOpen);
    this.socket.addEventListener('close', this.handleClose);
    this.socket.addEventListener('error', this.handleError);
    this.socket.addEventListener('message', this.handleMessage);
  }

  disconnect(code = 1000, reason = 'client_shutdown') {
    this.closedManually = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.removeEventListener('open', this.handleOpen);
      this.socket.removeEventListener('close', this.handleClose);
      this.socket.removeEventListener('error', this.handleError);
      this.socket.removeEventListener('message', this.handleMessage);
      try {
        this.socket.close(code, reason);
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }

  private handleOpen = () => {
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.handlers.onOpen?.();
  };

  private handleClose = (event: CloseEvent) => {
    this.handlers.onClose?.(event);
    this.socket = null;

    if (this.closedManually || !this.options.autoReconnect) {
      return;
    }

    const delay = Math.min(
      this.options.reconnectDelayMs * Math.max(1, this.reconnectAttempt + 1),
      this.options.maxReconnectDelayMs
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  };

  private handleError = (event: Event) => {
    this.handlers.onError?.(event);
  };

  private handleMessage = (event: MessageEvent<string>) => {
    let payload: RegenSocketEvent | null = null;
    try {
      payload = JSON.parse(event.data) as RegenSocketEvent;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[RegenRealtime] Failed to parse socket payload', error);
      }
      return;
    }

    this.handlers.onEvent?.(payload);
    switch (payload.type) {
      case 'message':
        this.handlers.onMessage?.(payload);
        break;
      case 'status':
        this.handlers.onStatus?.(payload);
        break;
      case 'command':
        this.handlers.onCommand?.(payload);
        break;
      case 'notification':
        this.handlers.onNotification?.(payload);
        break;
      case 'error':
        this.handlers.onStreamError?.(payload);
        break;
      default:
        break;
    }
  };
}

export function createRegenRealtimeClient(
  clientId: string,
  handlers: RegenRealtimeHandlers = {},
  options: RegenRealtimeOptions = {}
) {
  return new RegenRealtimeClient(clientId, handlers, options);
}
