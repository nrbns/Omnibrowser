/**
 * AppShell - Main layout container with all components wired
 */

import React, { useState, useEffect, Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { PermissionRequest, ConsentRequest, ipcEvents } from '../../lib/ipc-events';
import { useIPCEvent } from '../../lib/use-ipc-event';
import { useTabsStore } from '../../state/tabsStore';
import { ipc } from '../../lib/ipc-typed';
import { ResearchHighlight } from '../../types/research';

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
  copyStatus: 'success' | 'error' | null;
  copyMessage?: string;
  copying: boolean;
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; componentName?: string },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode; componentName?: string }) {
    super(props);
    this.state = { hasError: false, copyStatus: null, copying: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `ErrorBoundary caught error${this.props.componentName ? ` in ${this.props.componentName}` : ''}:`,
      error,
      errorInfo,
    );
    this.setState({ error, errorInfo: errorInfo.componentStack });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleOpenLogs = async () => {
    try {
      const result = await ipc.diagnostics.openLogs();
      this.setState({
        copyStatus: result?.success ? 'success' : 'error',
        copyMessage: result?.success ? 'Logs folder opened.' : 'Unable to open logs folder.',
        copying: false,
      });
    } catch (error) {
      console.error('Failed to open logs folder from error boundary:', error);
      this.setState({
        copyStatus: 'error',
        copyMessage: 'Failed to open logs folder.',
        copying: false,
      });
    }
  };

  private handleCopyDiagnostics = async () => {
    if (this.state.copying) return;
    this.setState({ copying: true, copyStatus: null, copyMessage: undefined });
    try {
      const result = await ipc.diagnostics.copyDiagnostics();
      if (result?.diagnostics && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.diagnostics);
        this.setState({
          copyStatus: 'success',
          copyMessage: 'Diagnostics copied to clipboard.',
          copying: false,
        });
      } else {
        this.setState({
          copyStatus: 'error',
          copyMessage: 'Clipboard unavailable. Diagnostics logged to console.',
          copying: false,
        });
        console.info('[Diagnostics] Summary:', result?.diagnostics);
      }
    } catch (error) {
      console.error('Failed to copy diagnostics from error boundary:', error);
      this.setState({
        copyStatus: 'error',
        copyMessage: 'Failed to copy diagnostics.',
        copying: false,
      });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-6 py-12 text-gray-100">
          <div className="w-full max-w-xl space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-500/20 p-2 text-red-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-red-200">
                  Something went wrong{this.props.componentName ? ` inside ${this.props.componentName}` : ''}.
                </h1>
                {this.state.error?.message && (
                  <p className="mt-2 text-sm text-red-100/80">{this.state.error.message}</p>
                )}
                <p className="mt-2 text-sm text-gray-400">
                  Try reloading the interface. You can also copy diagnostics or inspect the latest logs to share with the
                  team.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={this.handleReload}
                className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 hover:border-blue-500/70 transition-colors"
              >
                Reload app
              </button>
              <button
                onClick={this.handleCopyDiagnostics}
                disabled={this.state.copying}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  this.state.copying
                    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200/60 cursor-wait'
                    : 'border-indigo-500/50 bg-indigo-500/10 text-indigo-100 hover:border-indigo-500/70'
                }`}
              >
                {this.state.copying ? 'Copying…' : 'Copy diagnostics'}
              </button>
              <button
                onClick={this.handleOpenLogs}
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 hover:border-emerald-500/70 transition-colors"
              >
                Open logs folder
              </button>
            </div>

            {this.state.copyMessage && (
              <div
                className={`text-sm ${
                  this.state.copyStatus === 'success' ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {this.state.copyMessage}
              </div>
            )}

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="text-xs text-gray-400">
                <summary className="cursor-pointer text-gray-300">Stack trace</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3">
                  {this.state.errorInfo}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load heavy components
const TopNav = React.lazy(() => import('./TopNav').then(m => ({ default: m.TopNav })));
const TabStrip = React.lazy(() => import('./TabStrip').then(m => ({ default: m.TabStrip })));
const RightPanel = React.lazy(() => import('./RightPanel').then(m => ({ default: m.RightPanel })));
const BottomStatus = React.lazy(() => import('./BottomStatus').then(m => ({ default: m.BottomStatus })));
const CommandPalette = React.lazy(() => import('./CommandPalette').then(m => ({ default: m.CommandPalette })));
const PermissionPrompt = React.lazy(() => import('../Overlays/PermissionPrompt').then(m => ({ default: m.PermissionPrompt })));
const ConsentPrompt = React.lazy(() => import('../Overlays/ConsentPrompt').then(m => ({ default: m.ConsentPrompt })));
const AgentOverlay = React.lazy(() => import('../AgentOverlay').then(m => ({ default: m.AgentOverlay })));
const ClipperOverlay = React.lazy(() => import('../Overlays/ClipperOverlay').then(m => ({ default: m.ClipperOverlay })));
const ReaderOverlay = React.lazy(() => import('../Overlays/ReaderOverlay').then(m => ({ default: m.ReaderOverlay })));

export function AppShell() {
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const [consentRequest, setConsentRequest] = useState<ConsentRequest | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clipperActive, setClipperActive] = useState(false);
  const [readerActive, setReaderActive] = useState(false);
  const tabsState = useTabsStore();
  const activeTab = tabsState.tabs.find(tab => tab.id === tabsState.activeId);

  // Listen for permission requests
  useIPCEvent<PermissionRequest>('permissions:request', (request) => {
    setPermissionRequest(request);
  }, []);

  // Listen for consent requests
  useIPCEvent<any>(
    'agent:consent:request',
    (payload) => {
      if (!payload || !payload.id || !payload.action) return;
      const request: ConsentRequest = {
        id: payload.id,
        action: {
          type: payload.action.type,
          description: payload.action.description,
          risk: payload.action.risk ?? 'medium',
        },
        callback: async (approved: boolean) => {
          try {
            if (approved) {
              await ipc.consent.approve(payload.id);
            } else {
              await ipc.consent.revoke(payload.id);
            }
          } catch (error) {
            console.error('Failed to resolve consent:', error);
          } finally {
            setConsentRequest(null);
          }
        },
      };
      setConsentRequest(request);
    },
    [],
  );

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreen = (data: { fullscreen: boolean }) => {
      setIsFullscreen(data.fullscreen);
    };
    
    // Use the IPC event bus
    const unsubscribe = ipcEvents.on<{ fullscreen: boolean }>('app:fullscreen-changed', handleFullscreen);
    
    return unsubscribe;
  }, []);

  // Global keyboard shortcuts (Windows/Linux: Ctrl, macOS: Cmd)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // ⌘K / Ctrl+K: Command Palette
      if (modifier && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // ⌘L / Ctrl+L: Focus URL bar (handled in Omnibox, but ensure it works)
      if (modifier && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') {
        // Let Omnibox handle this, but don't prevent default if it's already handled
        return;
      }

      // ⌘T / Ctrl+T: New Tab
      if (modifier && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        ipc.tabs.create('about:blank').catch(console.error);
        return;
      }

      // ⌘W / Ctrl+W: Close Tab
      if (modifier && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        const state = useTabsStore.getState();
        if (state.activeId) {
          ipc.tabs.close({ id: state.activeId }).catch(console.error);
        }
        return;
      }

      // ⌘⇧T / Ctrl+Shift+T: Reopen Closed Tab
      if (modifier && e.shiftKey && !e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        // Would reopen last closed tab - need to implement closed tab history
        return;
      }

      // ⌘⇧A / Ctrl+Shift+A: Toggle Agent Console
      if (modifier && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setRightPanelOpen(prev => !prev);
        return;
      }

      // ⌘⇧H / Ctrl+Shift+H: Highlight clipper
      if (modifier && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (useTabsStore.getState().activeId) {
          setClipperActive(true);
        }
        return;
      }

      // ⌥⌘P / Alt+Ctrl+P: Proxy Menu (opens NetworkButton menu)
      if (modifier && e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        // Trigger NetworkButton click via data attribute
        const networkButton = document.querySelector('[data-network-button]') as HTMLElement;
        networkButton?.click();
        return;
      }

      // ⌥⌘S / Alt+Ctrl+S: Shields Menu (opens ShieldsButton menu)
      if (modifier && e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // Trigger ShieldsButton click via data attribute
        const shieldsButton = document.querySelector('[data-shields-button]') as HTMLElement;
        shieldsButton?.click();
        return;
      }

      // ⌘F / Ctrl+F: Find in Page (handled by browser)
      if (modifier && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        return;
      }

      // Alt+← / ⌘←: Go back (handled by TopNav)
      // Alt+→ / ⌘→: Go forward (handled by TopNav)
      // Ctrl+R / ⌘R: Refresh (handled by TopNav)

      // Esc: Close modals
      if (e.key === 'Escape') {
        if (clipperActive) {
          setClipperActive(false);
        } else if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (permissionRequest) {
          setPermissionRequest(null);
        } else if (consentRequest) {
          setConsentRequest(null);
        } else if (rightPanelOpen) {
          setRightPanelOpen(false);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, permissionRequest, consentRequest, rightPanelOpen, clipperActive]);

  const handleCreateHighlight = async (highlight: ResearchHighlight) => {
    if (!activeTab?.url) {
      setClipperActive(false);
      return;
    }
    try {
      const existing = await ipc.research.getNotes(activeTab.url);
      const notes = existing?.notes ?? '';
      const highlights = Array.isArray(existing?.highlights) ? existing.highlights : [];
      await ipc.research.saveNotes(activeTab.url, notes, [...highlights, highlight]);
      ipcEvents.emit('research:highlight-added', { url: activeTab.url, highlight });
    } catch (error) {
      console.error('Failed to save highlight:', error);
    } finally {
      setClipperActive(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1A1D28] text-gray-100 overflow-hidden relative">
      {/* Top Navigation - Hidden in fullscreen */}
      {!isFullscreen && (
        <Suspense fallback={<div style={{ height: '40px', backgroundColor: '#0f172a' }} />}>
          <ErrorBoundary componentName="TopNav" fallback={<div style={{ height: '40px', backgroundColor: '#0f172a', padding: '8px', color: '#94a3b8' }}>Navigation Error</div>}>
            <TopNav 
              onAgentToggle={() => setRightPanelOpen(!rightPanelOpen)}
              onCommandPalette={() => setCommandPaletteOpen(true)}
              onClipperToggle={() => {
                if (tabsState.activeId) {
                  setClipperActive(true);
                }
              }}
              onReaderToggle={() => {
                if (tabsState.activeId) {
                  setReaderActive(true);
                }
              }}
            />
          </ErrorBoundary>
        </Suspense>
      )}

      {/* Main Layout - Full Width (No Sidebar) */}
      <div className="flex flex-1 overflow-hidden w-full">
        {/* Center Content - Full Width */}
        <div className="flex flex-col flex-1 overflow-hidden w-full">
          {/* Tab Strip - Hidden in fullscreen */}
          {!isFullscreen && (
        <Suspense fallback={null}>
          <ErrorBoundary componentName="TabStrip">
            <TabStrip />
          </ErrorBoundary>
        </Suspense>
          )}

          {/* Route Content - Full Width */}
          <div className={`flex-1 overflow-hidden relative w-full ${isFullscreen ? 'absolute inset-0' : ''}`}>
            <Outlet />
          </div>
        </div>

        {/* Right Panel (Agent Console) - Hidden in fullscreen */}
        {!isFullscreen && (
        <Suspense fallback={null}>
          <ErrorBoundary componentName="RightPanel">
            <RightPanel 
              open={rightPanelOpen}
              onClose={() => setRightPanelOpen(false)}
            />
          </ErrorBoundary>
        </Suspense>
        )}
      </div>

      {/* Bottom Status Bar - Hidden in fullscreen */}
      {!isFullscreen && (
      <Suspense fallback={null}>
        <ErrorBoundary componentName="BottomStatus">
          <BottomStatus />
        </ErrorBoundary>
      </Suspense>
      )}

      {/* Agent Overlay */}
      <Suspense fallback={null}>
        <ErrorBoundary componentName="AgentOverlay">
          <AgentOverlay />
        </ErrorBoundary>
      </Suspense>

      <Suspense fallback={null}>
        <ErrorBoundary componentName="ClipperOverlay">
          <ClipperOverlay
            active={clipperActive}
            onCancel={() => setClipperActive(false)}
            onCreateHighlight={handleCreateHighlight}
          />
        </ErrorBoundary>
      </Suspense>

      <Suspense fallback={null}>
        <ErrorBoundary componentName="ReaderOverlay">
          <ReaderOverlay
            active={readerActive}
            onClose={() => setReaderActive(false)}
            tabId={tabsState.activeId}
            url={activeTab?.url}
          />
        </ErrorBoundary>
      </Suspense>

      {/* Overlays */}
      {commandPaletteOpen && (
        <Suspense fallback={null}>
          <ErrorBoundary componentName="CommandPalette">
            <CommandPalette onClose={() => setCommandPaletteOpen(false)} />
          </ErrorBoundary>
        </Suspense>
      )}

      {permissionRequest && (
        <Suspense fallback={null}>
          <ErrorBoundary componentName="PermissionPrompt">
            <PermissionPrompt 
              request={permissionRequest}
              onClose={() => setPermissionRequest(null)}
            />
          </ErrorBoundary>
        </Suspense>
      )}

      {consentRequest && (
        <Suspense fallback={null}>
          <ErrorBoundary componentName="ConsentPrompt">
            <ConsentPrompt 
              request={consentRequest}
              onClose={() => setConsentRequest(null)}
            />
          </ErrorBoundary>
        </Suspense>
      )}
    </div>
  );
}
