/**
 * Private Window / Ghost Mode / Incognito Support
 * In-memory partitions, content protection, automatic cleanup
 */

import { BrowserWindow, BrowserView, session } from 'electron';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { getMainWindow } from './windows';

export interface PrivateWindowOptions {
  url?: string;
  autoCloseAfter?: number; // milliseconds (e.g., 10 minutes = 600000)
  contentProtection?: boolean; // macOS: prevent screen recording
  ghostMode?: boolean; // Enhanced privacy: max fingerprint protection
}

const privateWindows = new Map<number, {
  window: BrowserWindow;
  partition: string;
  autoCloseTimer?: NodeJS.Timeout;
  createdAt: number;
}>();

/**
 * Create a private window with in-memory partition
 * Data is not persisted - cookies, storage, etc. are cleared on close
 */
export function createPrivateWindow(options: PrivateWindowOptions = {}): BrowserWindow {
  const partition = `temp:private:${randomUUID()}`;
  const sess = session.fromPartition(partition, { cache: false });
  
  // Clear partition on close
  sess.clearStorageData();
  sess.clearCache();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#1A1D28',
    title: 'OmniBrowser (Private)',
    webPreferences: {
      session: sess,
      partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
    // macOS content protection
    ...(options.contentProtection !== false && process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
    } : {}),
  });

  // Apply content protection (macOS)
  if (options.contentProtection !== false && process.platform === 'darwin') {
    win.setContentProtection(true);
  }

  // Load URL
  if (options.url) {
    win.loadURL(options.url);
  } else {
    win.loadURL('about:blank');
  }

  // Auto-close timer
  if (options.autoCloseAfter && options.autoCloseAfter > 0) {
    const timer = setTimeout(() => {
      win.close();
    }, options.autoCloseAfter);
    privateWindows.set(win.id, {
      window: win,
      partition,
      autoCloseTimer: timer,
      createdAt: Date.now(),
    });
  } else {
    privateWindows.set(win.id, {
      window: win,
      partition,
      createdAt: Date.now(),
    });
  }

  // Cleanup on close
  win.on('closed', () => {
    const record = privateWindows.get(win.id);
    if (record) {
      if (record.autoCloseTimer) {
        clearTimeout(record.autoCloseTimer);
      }
      // Clear all data
      sess.clearStorageData();
      sess.clearCache();
      sess.clearHostResolverCache();
      privateWindows.delete(win.id);
    }
  });

  return win;
}

/**
 * Create a ghost tab (enhanced private tab in existing window)
 */
export function createGhostTab(
  window: BrowserWindow,
  url: string = 'about:blank'
): string {
  const partition = `temp:ghost:${randomUUID()}`;
  const sess = session.fromPartition(partition, { cache: false });
  
  const { BrowserView } = require('electron');
  const view = new BrowserView({
    webPreferences: {
      session: sess,
      partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  view.webContents.loadURL(url);

  // Track ghost tab
  // Would integrate with tabs.ts to add ghost tab to window
  // For now, return tab ID placeholder
  return randomUUID();
}

/**
 * Check if a window is private
 */
export function isPrivateWindow(windowId: number): boolean {
  return privateWindows.has(windowId);
}

/**
 * Get all private windows
 */
export function getPrivateWindows(): BrowserWindow[] {
  return Array.from(privateWindows.values()).map(r => r.window);
}

/**
 * Close all private windows (panic mode)
 */
export function closeAllPrivateWindows(): number {
  let count = 0;
  for (const record of privateWindows.values()) {
    record.window.close();
    count++;
  }
  return count;
}
