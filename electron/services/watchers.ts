// @ts-nocheck

import { app, BrowserWindow, Notification } from 'electron';
import { randomUUID, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';

type WatcherStatus = 'idle' | 'checking' | 'changed' | 'error';

export interface PageWatcher {
  id: string;
  url: string;
  createdAt: number;
  intervalMinutes: number;
  lastCheckedAt?: number;
  lastHash?: string;
  lastChangeAt?: number;
  status: WatcherStatus;
  error?: string;
}

const watchers = new Map<string, PageWatcher>();
const timers = new Map<string, NodeJS.Timeout>();

let watchersFile: string | null = null;
let initialized = false;

function resolveWatchersFile(): string {
  if (!watchersFile) {
    const base = app.getPath('userData');
    watchersFile = path.join(base, 'watchers.json');
  }
  return watchersFile;
}

async function loadWatchersFromDisk(): Promise<void> {
  try {
    const file = resolveWatchersFile();
    const content = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(content) as PageWatcher[];
    watchers.clear();
    parsed.forEach((watcher) => {
      watchers.set(watcher.id, watcher);
    });
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('[Watchers] Failed to load watchers:', error);
    }
  }
}

async function persistWatchers(): Promise<void> {
  try {
    const file = resolveWatchersFile();
    await fs.writeFile(file, JSON.stringify(Array.from(watchers.values()), null, 2), 'utf-8');
  } catch (error) {
    console.warn('[Watchers] Failed to persist watchers:', error);
  }
}

function emitUpdate(): void {
  const payload = Array.from(watchers.values());
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send('watchers:updated', payload);
      } catch {}
    }
  });
}

function emitChange(watcher: PageWatcher): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send('watchers:changed', watcher);
      } catch {}
    }
  });
}

function getNextCheckDelay(watcher: PageWatcher): number {
  const intervalMs = Math.max(1, watcher.intervalMinutes) * 60 * 1000;
  if (!watcher.lastCheckedAt) return 0;
  const elapsed = Date.now() - watcher.lastCheckedAt;
  return Math.max(0, intervalMs - elapsed);
}

async function runWatcherCheck(id: string, reason: 'scheduled' | 'manual'): Promise<void> {
  const watcher = watchers.get(id);
  if (!watcher) return;

  watcher.status = 'checking';
  watcher.error = undefined;
  await persistWatchers();
  emitUpdate();

  try {
    const response = await fetch(watcher.url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    const hash = createHash('sha256').update(html).digest('hex');

    const firstRun = !watcher.lastHash;
    const hasChanged = watcher.lastHash && watcher.lastHash !== hash;

    watcher.lastCheckedAt = Date.now();
    watcher.lastHash = hash;

    if (hasChanged) {
      watcher.status = 'changed';
      watcher.lastChangeAt = watcher.lastCheckedAt;
      emitChange({ ...watcher, status: 'changed' });
      try {
        new Notification({
          title: 'Page changed',
          body: watcher.url,
        }).show();
      } catch (error) {
        console.warn('[Watchers] Failed to show change notification:', error);
      }
    } else if (firstRun) {
      watcher.status = 'idle';
    } else if (watcher.status !== 'changed') {
      watcher.status = 'idle';
    }
  } catch (error: any) {
    watcher.status = 'error';
    watcher.error = error instanceof Error ? error.message : String(error);
  } finally {
    await persistWatchers();
    emitUpdate();
  }
}

function scheduleWatcher(id: string): void {
  const watcher = watchers.get(id);
  if (!watcher) return;

  if (timers.has(id)) {
    const timer = timers.get(id)!;
    clearTimeout(timer);
    timers.delete(id);
  }

  const delay = getNextCheckDelay(watcher);
  const timer = setTimeout(async () => {
    await runWatcherCheck(id, 'scheduled');
    scheduleWatcher(id);
  }, delay);
  timers.set(id, timer);
}

function scheduleAllWatchers(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  watchers.forEach((_, id) => scheduleWatcher(id));
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await loadWatchersFromDisk();
  scheduleAllWatchers();
  emitUpdate();
}

export function registerWatchersIpc(): void {
  ensureInitialized().catch((error) => {
    console.error('[Watchers] Initialization failed:', error);
  });

  registerHandler('watchers:list', z.object({}), async () => {
    await ensureInitialized();
    return Array.from(watchers.values());
  });

  registerHandler('watchers:add', z.object({
    url: z.string().url(),
    intervalMinutes: z.number().min(1).max(1440).optional(),
  }), async (_event, request) => {
    await ensureInitialized();
    const id = randomUUID();
    const watcher: PageWatcher = {
      id,
      url: request.url,
      intervalMinutes: request.intervalMinutes ?? 15,
      createdAt: Date.now(),
      status: 'idle',
    };
    watchers.set(id, watcher);
    await persistWatchers();
    emitUpdate();
    scheduleWatcher(id);
    // Run an immediate baseline check asynchronously
    runWatcherCheck(id, 'manual').finally(() => scheduleWatcher(id));
    return watcher;
  });

  registerHandler('watchers:remove', z.object({ id: z.string() }), async (_event, request) => {
    await ensureInitialized();
    if (timers.has(request.id)) {
      clearTimeout(timers.get(request.id)!);
      timers.delete(request.id);
    }
    const removed = watchers.delete(request.id);
    if (removed) {
      await persistWatchers();
      emitUpdate();
    }
    return { success: removed };
  });

  registerHandler('watchers:trigger', z.object({ id: z.string() }), async (_event, request) => {
    await ensureInitialized();
    const watcher = watchers.get(request.id);
    if (!watcher) {
      return { success: false, error: 'Watcher not found' };
    }
    await runWatcherCheck(request.id, 'manual');
    scheduleWatcher(request.id);
    return { success: true };
  });

  registerHandler('watchers:updateInterval', z.object({
    id: z.string(),
    intervalMinutes: z.number().min(1).max(1440),
  }), async (_event, request) => {
    await ensureInitialized();
    const watcher = watchers.get(request.id);
    if (!watcher) {
      return { success: false, error: 'Watcher not found' };
    }
    watcher.intervalMinutes = request.intervalMinutes;
    watcher.status = 'idle';
    await persistWatchers();
    scheduleWatcher(request.id);
    emitUpdate();
    return { success: true };
  });
}

