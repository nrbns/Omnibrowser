import { BrowserWindow, session } from 'electron';
import { randomUUID } from 'node:crypto';
import { getContainerManager } from './containers';

type StealthFetchOptions = {
  timeout?: number;
  userAgent?: string;
  waitFor?: 'load' | 'dom-ready';
};

type StealthFetchResult = {
  html: string;
  finalUrl: string;
  title: string;
};

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_USER_AGENT = 'OmniBrowserBot/1.0 (stealth-fetch)';
const MAX_CONCURRENT_FETCHES = 3;

let activeFetches = 0;
const pendingResolvers: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeFetches < MAX_CONCURRENT_FETCHES) {
    activeFetches += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    pendingResolvers.push(resolve);
  });
  activeFetches += 1;
}

function releaseSlot(): void {
  activeFetches = Math.max(0, activeFetches - 1);
  const next = pendingResolvers.shift();
  if (next) {
    next();
  }
}

async function cleanupSession(partition: string): Promise<void> {
  try {
    const sess = session.fromPartition(partition, { cache: false });
    await Promise.allSettled([
      sess.clearCache(),
      sess.clearStorageData(),
      sess.clearHostResolverCache?.(),
      sess.clearAuthCache?.({ type: 'password' }),
    ]);
  } catch (error) {
    console.warn('[StealthFetch] Failed to cleanup session:', error);
  }
}

export async function stealthFetchPage(
  url: string,
  options: StealthFetchOptions = {},
): Promise<StealthFetchResult | null> {
  await acquireSlot();

  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const waitFor = options.waitFor ?? 'load';
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const tabId = randomUUID();

  const containerManager = getContainerManager();
  const resolution = containerManager.resolvePartition({
    containerId: 'stealth',
    tabId,
  });

  const partition = resolution.basePartition;
  const partitionOptions = resolution.partitionOptions ?? { cache: false };
  const sess = session.fromPartition(partition, partitionOptions);

  let win: BrowserWindow | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  const resetTimeout = (callback: () => void) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(callback, timeout);
  };

  try {
    win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      backgroundColor: '#101320',
      useContentSize: true,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      skipTaskbar: true,
      webPreferences: {
        session: sess,
        partition,
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });

    win.setMenuBarVisibility(false);

    await win.loadURL(url, {
      httpReferrer: '',
      userAgent,
    });

    await new Promise<void>((resolve, reject) => {
      const wc = win!.webContents;

      const failHandler = (_event: any, errorCode: number, errorDesc: string, validatedURL: string, isMainFrame: boolean) => {
        if (!isMainFrame) return;
        cleanup();
        reject(new Error(`Failed to load ${validatedURL}: [${errorCode}] ${errorDesc}`));
      };

      const timeoutHandler = () => {
        cleanup();
        reject(new Error(`Timed out fetching ${url}`));
      };

      const cleanup = () => {
        wc.removeListener('did-fail-load', failHandler);
        wc.removeListener('did-stop-loading', stopHandler);
        wc.removeListener('dom-ready', domReadyHandler);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const stopHandler = () => {
        if (waitFor === 'load') {
          cleanup();
          resolve();
        }
      };

      const domReadyHandler = () => {
        if (waitFor === 'dom-ready') {
          cleanup();
          resolve();
        }
      };

      wc.once('did-fail-load', failHandler);
      wc.once('did-stop-loading', stopHandler);
      wc.once('dom-ready', domReadyHandler);

      resetTimeout(timeoutHandler);
    });

    const wc = win.webContents;
    const [html, title] = await Promise.all([
      wc.executeJavaScript('document.documentElement.outerHTML', true).catch(() => ''),
      wc.executeJavaScript('document.title || ""', true).catch(() => ''),
    ]);

    const finalUrl = wc.getURL() || url;

    if (!html) {
      return null;
    }

    return {
      html,
      finalUrl,
      title: title || finalUrl || url,
    };
  } catch (error) {
    console.warn('[StealthFetch] Failed to fetch page:', error);
    return null;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
    await cleanupSession(partition);
    releaseSlot();
  }
}


