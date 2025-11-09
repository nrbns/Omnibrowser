/**
 * Burn Tab + Panic Wipe
 * Instantly clear all data from a tab or entire browser
 */

import { BrowserWindow, BrowserView, session } from 'electron';
import { getTabs } from './tabs';
// @ts-nocheck

import { getMainWindow } from './windows';

/**
 * Burn a specific tab - clear all data immediately
 */
export async function burnTab(window: BrowserWindow, tabId: string): Promise<void> {
  // Get tab BrowserView
  const tabs = getTabs(window);
  const tab = tabs.find(t => t.id === tabId);
  
  if (!tab) return;

  const view = tab.view;
  const webContents = view.webContents;
  const sess = webContents.session;

  // Stop loading
  webContents.stop();

  // Clear all data for this session
  await Promise.all([
    sess.clearStorageData({}).catch(() => {}),
    sess.clearCache(),
    sess.clearHostResolverCache(),
    sess.clearAuthCache(),
    sess.clearCodeCaches({}).catch(() => {}),
  ]);

  // Navigate to blank page
  webContents.loadURL('about:blank');

  // Clear cookies
  await sess.cookies.remove(webContents.getURL(), '*');
}

/**
 * Panic wipe - clear all browser data
 */
export async function panicWipe(window: BrowserWindow): Promise<void> {
  const tabs = getTabs(window);
  
  // Burn all tabs
  for (const tab of tabs) {
    await burnTab(window, tab.id);
  }

  // Clear default session
  const defaultSession = session.defaultSession;
  await Promise.all([
    defaultSession.clearStorageData({}).catch(() => {}),
    defaultSession.clearCache(),
    defaultSession.clearHostResolverCache(),
    defaultSession.clearAuthCache(),
    defaultSession.clearCodeCaches({}).catch(() => {}),
  ]);

  // Clear all cookies
  const cookies = await defaultSession.cookies.get({});
  for (const cookie of cookies) {
    const url = (cookie as any).url || cookie.domain || '';
    await defaultSession.cookies.remove(url, cookie.name).catch(() => {});
  }

  // Clear all partitions (profiles, sessions, etc.)
  // Note: This is aggressive - you may want to be selective
  const allPartitions = [
    'persist:default',
    // Add other partitions as needed
  ];

  for (const partitionName of allPartitions) {
    const sess = session.fromPartition(partitionName);
    await Promise.all([
      sess.clearStorageData(),
      sess.clearCache(),
      sess.clearHostResolverCache(),
    ]);
  }
}

/**
 * Forensic cleanse - deeper wipe including disk cache
 */
export async function forensicCleanse(window: BrowserWindow): Promise<void> {
  await panicWipe(window);

  const defaultSession = session.defaultSession;
  
  // Clear disk cache (more thorough)
  await defaultSession.clearStorageData({
    storages: [
      'cookies',
      'filesystem',
      'indexdb',
      'localstorage',
      'shadercache',
      'websql',
      'serviceworkers',
      'cachestorage',
    ],
    quotas: ['temporary', 'syncable'] as any,
  });

  // Clear code caches
  await defaultSession.clearCodeCaches({}).catch(() => {});
}
