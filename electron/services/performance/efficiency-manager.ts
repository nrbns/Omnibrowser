import { BrowserWindow } from 'electron';
import { getTabs } from '../tabs';
import { hibernateTab, isTabSleeping } from '../tab-sleep';

type EfficiencyMode = 'normal' | 'battery-saver' | 'extreme';

export type ResourceSnapshot = {
  batteryPct: number | null;
  charging: boolean | null;
  ramMb: number;
  cpuLoad1: number;
  activeTabs: number;
};

const BATTERY_SAVER_THRESHOLD = 30; // %
const EXTREME_THRESHOLD = 20; // %
const RAM_SAVER_THRESHOLD = 155; // MB
const RAM_EXTREME_THRESHOLD = 180; // MB
const CPU_SAVER_THRESHOLD = 1.5;
const CPU_EXTREME_THRESHOLD = 2.5;

const MODE_LABELS: Record<EfficiencyMode, string> = {
  normal: 'Performance Mode',
  'battery-saver': 'Battery Saver Mode',
  extreme: 'Regen Mode',
};

const MODE_BADGES: Record<EfficiencyMode, string | null> = {
  normal: null,
  'battery-saver': '+0.8hr battery',
  extreme: '+1.8hr battery',
};

const MODE_TAGS: Record<EfficiencyMode, string[]> = {
  normal: ['eco', 'action', 'mode:normal'],
  'battery-saver': ['eco', 'action', 'mode:battery-saver'],
  extreme: ['eco', 'action', 'mode:extreme', 'regen'],
};

const HIBERNATION_COOLDOWN_MS = 60_000;

let currentMode: EfficiencyMode = 'normal';
let appliedFrameRate = 60;
let lastHibernateAt = 0;
let lastTelemetryHash: string | null = null;

export function applyEfficiencyPolicies(snapshot: ResourceSnapshot): void {
  const { batteryPct, charging, ramMb, cpuLoad1 } = snapshot;
  const onBattery = charging === false || charging === null;

  let nextMode: EfficiencyMode = 'normal';

  if (ramMb >= RAM_EXTREME_THRESHOLD || cpuLoad1 >= CPU_EXTREME_THRESHOLD) {
    nextMode = 'extreme';
  } else if (ramMb >= RAM_SAVER_THRESHOLD || cpuLoad1 >= CPU_SAVER_THRESHOLD) {
    nextMode = 'battery-saver';
  }

  if (onBattery && batteryPct !== null) {
    if (batteryPct <= EXTREME_THRESHOLD) {
      nextMode = 'extreme';
    } else if (batteryPct <= BATTERY_SAVER_THRESHOLD) {
      nextMode = nextMode === 'extreme' ? 'extreme' : 'battery-saver';
    }
  }

  if (nextMode !== currentMode) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[efficiency] mode change: ${currentMode} -> ${nextMode}`);
    }
    applyMode(nextMode);
    currentMode = nextMode;
    notifyModeChange(nextMode, snapshot);
  }

  if (nextMode !== 'normal') {
    maybeHibernateInactiveTabs(nextMode);
  }
}

function applyMode(mode: EfficiencyMode) {
  switch (mode) {
    case 'extreme':
      setGlobalFrameRate(24);
      setBackgroundThrottling(true);
      break;
    case 'battery-saver':
      setGlobalFrameRate(30);
      setBackgroundThrottling(true);
      break;
    case 'normal':
    default:
      setGlobalFrameRate(60);
      setBackgroundThrottling(false);
      break;
  }
}

function setGlobalFrameRate(fps: number) {
  if (appliedFrameRate === fps) {
    return;
  }

  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    const wc = win.webContents;
    if (typeof wc.setFrameRate === 'function') {
      try {
        wc.setFrameRate(fps);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[efficiency] failed to set frame rate', error);
        }
      }
    }
  }

  appliedFrameRate = fps;
}

function setBackgroundThrottling(enabled: boolean) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.setBackgroundThrottling(enabled);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[efficiency] failed to set throttling', error);
      }
    }
  }
}

function maybeHibernateInactiveTabs(mode: EfficiencyMode) {
  const now = Date.now();
  if (now - lastHibernateAt < HIBERNATION_COOLDOWN_MS) {
    return;
  }

  const limit = mode === 'extreme' ? 6 : 3;
  const staleThreshold = mode === 'extreme' ? 60_000 : 5 * 60_000;

  const candidates: Array<{ tabId: string; lastActiveAt: number }> = [];

  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    const tabs = getTabs(win);

    for (const tab of tabs) {
      if (tab.active) continue;
      if (tab.sleeping) continue;
      if (isTabSleeping(tab.id)) continue;

      const lastActive = tab.lastActiveAt ?? 0;
      if (now - lastActive < staleThreshold) continue;

      candidates.push({ tabId: tab.id, lastActiveAt: lastActive });
    }
  }

  if (candidates.length === 0) {
    return;
  }

  candidates.sort((a, b) => a.lastActiveAt - b.lastActiveAt);
  const toHibernate = candidates.slice(0, limit);

  for (const item of toHibernate) {
    try {
      hibernateTab(item.tabId);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[efficiency] hibernated tab ${item.tabId}`);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[efficiency] failed to hibernate tab', error);
      }
    }
  }

  lastHibernateAt = now;
}

function notifyModeChange(mode: EfficiencyMode, snapshot: ResourceSnapshot) {
  const payload = {
    mode,
    label: MODE_LABELS[mode],
    badge: MODE_BADGES[mode],
    snapshot,
    timestamp: Date.now(),
  };

  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send('efficiency:mode', payload);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[efficiency] failed to broadcast mode change', error);
      }
    }
  }

  void logModeTelemetry(mode, snapshot);
}

async function logModeTelemetry(mode: EfficiencyMode, snapshot: ResourceSnapshot) {
  const baseUrl = process.env.MEMORY_BASE || process.env.REDIX_MEMORY_BASE;
  if (!baseUrl) {
    return;
  }

  const project = process.env.ALLOWED_PROJECTS?.split(',').map((entry) => entry.trim()).find((entry) => entry === 'redix') ?? 'redix';

  const payload = {
    project,
    type: 'action',
    text: `efficiency.mode:${mode}`,
    tags: MODE_TAGS[mode],
    origin: { app: 'omnibrowser', module: 'efficiency-manager' },
    rich: {
      mode,
      battery_pct: snapshot.batteryPct,
      charging: snapshot.charging,
      ram_mb: snapshot.ramMb,
      cpu_load1: snapshot.cpuLoad1,
      active_tabs: snapshot.activeTabs,
    },
    created_at: new Date().toISOString(),
  };

  const hash = JSON.stringify(payload.rich);
  if (hash === lastTelemetryHash) {
    return;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/memory.write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant': process.env.MEMORY_TENANT || 'dev',
        'x-user': process.env.MEMORY_USER || 'u42',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok && process.env.NODE_ENV === 'development') {
      console.warn('[efficiency] failed to log mode change', response.status, await response.text());
    } else {
      lastTelemetryHash = hash;
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[efficiency] telemetry error', error);
    }
  }
}

