/**
 * AppShell - Main layout container with all components wired
 */

import React, { useState, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PermissionRequest, ConsentRequest, ipcEvents } from '../../lib/ipc-events';
import { useIPCEvent } from '../../lib/use-ipc-event';
import { useTabsStore } from '../../state/tabsStore';
import { ipc } from '../../lib/ipc-typed';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; componentName?: string },
  { hasError: boolean; error?: Error; errorInfo?: string }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode; componentName?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`ErrorBoundary caught error${this.props.componentName ? ` in ${this.props.componentName}` : ''}:`, error, errorInfo);
    this.setState({ error, errorInfo: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      // If there's a custom fallback, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Otherwise, return null to hide the error silently in production
      // or show minimal error info in development
      if (process.env.NODE_ENV === 'development') {
        return (
          <div style={{ 
            padding: '8px', 
            color: '#ef4444', 
            fontSize: '11px',
            backgroundColor: '#1e1e1e',
            borderLeft: '2px solid #ef4444'
          }}>
            {this.props.componentName ? `${this.props.componentName} error` : 'Component error'}
            {this.state.error && (
              <details style={{ marginTop: '4px', color: '#94a3b8' }}>
                <summary style={{ cursor: 'pointer' }}>Details</summary>
                <pre style={{ fontSize: '10px', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        );
      }
      
      // In production, hide errors silently to avoid UI clutter
      return null;
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

export function AppShell() {
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const [consentRequest, setConsentRequest] = useState<ConsentRequest | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listen for permission requests
  useIPCEvent<PermissionRequest>('permissions:request', (request) => {
    setPermissionRequest(request);
  }, []);

  // Listen for consent requests
  useIPCEvent<ConsentRequest>('agent:consent:request', (request) => {
    setConsentRequest(request);
  }, []);

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
        if (commandPaletteOpen) {
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
  }, [commandPaletteOpen, permissionRequest, consentRequest, rightPanelOpen]);

  return (
    <div className="flex flex-col h-screen bg-[#1A1D28] text-gray-100 overflow-hidden relative">
      {/* Top Navigation - Hidden in fullscreen */}
      {!isFullscreen && (
        <Suspense fallback={<div style={{ height: '40px', backgroundColor: '#0f172a' }} />}>
          <ErrorBoundary componentName="TopNav" fallback={<div style={{ height: '40px', backgroundColor: '#0f172a', padding: '8px', color: '#94a3b8' }}>Navigation Error</div>}>
            <TopNav 
              onAgentToggle={() => setRightPanelOpen(!rightPanelOpen)}
              onCommandPalette={() => setCommandPaletteOpen(true)}
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
