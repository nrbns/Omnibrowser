/**
 * Real-time IPC Event System
 * Typed event listeners for live updates from main process
 */

import { ipc } from './ipc-typed';

export interface TabUpdate {
  id: string;
  title: string;
  url: string;
  active: boolean;
  favicon?: string;
  progress?: number;
  isLoading?: boolean;
}

export interface ShieldsCounters {
  tabId: string;
  ads: number;
  trackers: number;
  httpsUpgrades: number;
  cookiesBlocked: number;
}

export interface NetworkStatus {
  proxy?: {
    enabled: boolean;
    type: 'socks5' | 'http' | 'tor';
    host?: string;
  };
  tor?: {
    enabled: boolean;
    circuitEstablished: boolean;
    identity: string;
  };
  vpn?: {
    enabled: boolean;
    connected: boolean;
    provider?: string;
  };
  doh?: {
    enabled: boolean;
    provider: string;
  };
}

export interface DownloadUpdate {
  id: string;
  url: string;
  filename: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  receivedBytes?: number;
  totalBytes?: number;
  path?: string;
  checksum?: string;
}

export interface AgentStep {
  taskId: string;
  stepId: string;
  type: 'plan' | 'tool' | 'log' | 'result';
  content: string;
  timestamp: number;
}

export interface AgentPlan {
  taskId: string;
  steps: Array<{ id: string; description: string; tool?: string }>;
  budget: { tokens: number; seconds: number; requests: number };
  remaining: { tokens: number; seconds: number; requests: number };
}

export interface PermissionRequest {
  id: string;
  origin: string;
  permission: 'camera' | 'microphone' | 'filesystem' | 'notifications';
  callback: (granted: boolean, remember?: boolean) => void;
}

export interface ConsentRequest {
  id: string;
  action: {
    type: string;
    description: string;
    risk: 'low' | 'medium' | 'high';
  };
  callback: (approved: boolean) => void;
}

export interface TabNavigationState {
  tabId: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

// Event bus for renderer-side state management
class IPCEventBus {
  private listeners = new Map<string, Set<(data: any) => void>>();

  on<T>(event: string, callback: (data: T) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Subscribe to IPC channel if window.ipc exists
    if (window.ipc && (window.ipc as any).on) {
      (window.ipc as any).on(event, callback);
    }

    // Also listen for custom events
    const handler = (e: CustomEvent) => callback(e.detail);
    window.addEventListener(event, handler as EventListener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
      if (window.ipc && (window.ipc as any).removeListener) {
        (window.ipc as any).removeListener(event, callback);
      }
      window.removeEventListener(event, handler as EventListener);
    };
  }

  emit(event: string, data: any) {
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback);
    if (window.ipc && (window.ipc as any).removeListener) {
      (window.ipc as any).removeListener(event, callback);
    }
  }
}

export const ipcEvents = new IPCEventBus();

// Subscribe to typed IPC channels
if (typeof window !== 'undefined') {
  // Listen for tab updates
  if (window.ipc && (window.ipc as any).on) {
    const tabUpdateHandler = (_event: any, tabs: any) => {
      // Handle both direct data and event+data formats
      const tabList = Array.isArray(tabs) ? tabs : (Array.isArray(_event) ? _event : []);
      ipcEvents.emit('tabs:updated', tabList);
    };
    const tabProgressHandler = (_event: any, data: any) => {
      const progressData = data || _event;
      ipcEvents.emit('tabs:progress', progressData);
    };
    const navigationStateHandler = (_event: any, data: any) => {
      const navData = data || _event;
      ipcEvents.emit('tabs:navigation-state', navData);
    };

    // Listen to both legacy and typed IPC channels
    (window.ipc as any).on('tabs:updated', tabUpdateHandler);
    (window.ipc as any).on('ob://ipc/v1/tabs:updated', tabUpdateHandler);
    (window.ipc as any).on('tabs:progress', tabProgressHandler);
    (window.ipc as any).on('ob://ipc/v1/tabs:progress', tabProgressHandler);
    (window.ipc as any).on('tabs:navigation-state', navigationStateHandler);
    (window.ipc as any).on('ob://ipc/v1/tabs:navigation-state', navigationStateHandler);

    // Proper cleanup using Page Lifecycle API instead of unload
    const cleanup = () => {
      if (window.ipc && (window.ipc as any).removeListener) {
        (window.ipc as any).removeListener('tabs:updated', tabUpdateHandler);
        (window.ipc as any).removeListener('ob://ipc/v1/tabs:updated', tabUpdateHandler);
        (window.ipc as any).removeListener('tabs:progress', tabProgressHandler);
        (window.ipc as any).removeListener('ob://ipc/v1/tabs:progress', tabProgressHandler);
        (window.ipc as any).removeListener('tabs:navigation-state', navigationStateHandler);
        (window.ipc as any).removeListener('ob://ipc/v1/tabs:navigation-state', navigationStateHandler);
      }
    };

    // Use pagehide event (modern alternative to unload)
    if ('onpagehide' in window) {
      window.addEventListener('pagehide', cleanup);
    }
    // Fallback for browsers that don't support pagehide
    if (typeof document !== 'undefined' && 'visibilityState' in document) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          // Don't cleanup on visibility change, only on actual page unload
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  // Listen for shields counters
  window.addEventListener('shields:counters', ((e: CustomEvent<ShieldsCounters>) => {
    ipcEvents.emit('shields:counters', e.detail);
  }) as EventListener);

  // Listen for network status
  window.addEventListener('net:status', ((e: CustomEvent<NetworkStatus>) => {
    ipcEvents.emit('net:status', e.detail);
  }) as EventListener);

  // Listen for downloads
  window.addEventListener('downloads:started', ((e: CustomEvent<DownloadUpdate>) => {
    ipcEvents.emit('downloads:started', e.detail);
  }) as EventListener);
  window.addEventListener('downloads:progress', ((e: CustomEvent<DownloadUpdate>) => {
    ipcEvents.emit('downloads:progress', e.detail);
  }) as EventListener);
  window.addEventListener('downloads:done', ((e: CustomEvent<DownloadUpdate>) => {
    ipcEvents.emit('downloads:done', e.detail);
  }) as EventListener);

  // Listen for agent events
  window.addEventListener('agent:plan', ((e: CustomEvent<AgentPlan>) => {
    ipcEvents.emit('agent:plan', e.detail);
  }) as EventListener);
  window.addEventListener('agent:step', ((e: CustomEvent<AgentStep>) => {
    ipcEvents.emit('agent:step', e.detail);
  }) as EventListener);
  window.addEventListener('agent:log', ((e: CustomEvent<AgentStep>) => {
    ipcEvents.emit('agent:log', e.detail);
  }) as EventListener);
  window.addEventListener('agent:consent:request', ((e: CustomEvent<ConsentRequest>) => {
    ipcEvents.emit('agent:consent:request', e.detail);
  }) as EventListener);

  // Listen for streaming AI events via IPC
  if (window.ipc && (window.ipc as any).on) {
    (window.ipc as any).on('agent:stream:chunk', (_event: any, data: any) => {
      ipcEvents.emit('agent:stream:chunk', data);
    });
    (window.ipc as any).on('agent:stream:done', (_event: any, data: any) => {
      ipcEvents.emit('agent:stream:done', data);
    });
    (window.ipc as any).on('agent:stream:error', (_event: any, data: any) => {
      ipcEvents.emit('agent:stream:error', data);
    });
  }

  // Listen for permission requests
  window.addEventListener('permissions:request', ((e: CustomEvent<PermissionRequest>) => {
    ipcEvents.emit('permissions:request', e.detail);
  }) as EventListener);

  // Listen for fullscreen changes
  window.addEventListener('app:fullscreen-changed', ((e: CustomEvent<{ fullscreen: boolean }>) => {
    ipcEvents.emit('app:fullscreen-changed', e.detail);
  }) as EventListener);

  // Also listen via IPC if available
  if (window.ipc && (window.ipc as any).on) {
    const fullscreenHandler = (data: { fullscreen: boolean }) => {
      ipcEvents.emit('app:fullscreen-changed', data);
    };
    (window.ipc as any).on('app:fullscreen-changed', fullscreenHandler);
    
    // Cleanup handler for fullscreen events
    const cleanupFullscreen = () => {
      if (window.ipc && (window.ipc as any).removeListener) {
        (window.ipc as any).removeListener('app:fullscreen-changed', fullscreenHandler);
      }
    };
    
    // Use pagehide for cleanup (modern alternative to unload)
    if ('onpagehide' in window) {
      window.addEventListener('pagehide', cleanupFullscreen, { once: true });
    }
  }
}

// React hooks for easy component integration
// Note: This hook must be imported and used in React components
// The actual hook implementation is in a separate file to avoid require() in browser

