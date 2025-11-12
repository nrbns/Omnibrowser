/**
 * Session Bundle (.obtask format)
 * Export and replay agent runs
 */

import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AgentStore } from './agent/store';
import { getTabs, getActiveTabIdForWindow, closeAllTabs, createTabOnWindow, activateTabByWindowId } from './tabs';
import { getMainWindow } from './windows';

export interface SessionBundle {
  version: '1.0';
  metadata: {
    id: string;
    createdAt: number;
    name?: string;
    description?: string;
  };
  agentRun?: {
    runId: string;
    dsl: unknown;
    steps: unknown[];
    startedAt: number;
    finishedAt?: number;
  };
  workspace?: {
    tabs: Array<{ id: string; url: string; title?: string; containerId?: string }>;
    activeTabId?: string;
  };
  artifacts?: Array<{
    type: 'csv' | 'json' | 'markdown' | 'graphml';
    name: string;
    content: string;
  }>;
}

export class SessionBundleService {
  private storagePath: string;

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), 'bundles');
    this.ensureStorageDir();
  }

  /**
   * Export agent run as .obtask bundle
   */
  async exportBundle(
    runId: string,
    agentStore: AgentStore,
    options?: { name?: string; description?: string; includeWorkspace?: boolean }
  ): Promise<string> {
    const run = agentStore.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const bundle: SessionBundle = {
      version: '1.0',
      metadata: {
        id: runId,
        createdAt: run.startedAt,
        name: options?.name || `Agent Run ${runId.slice(0, 8)}`,
        description: options?.description,
      },
      agentRun: {
        runId,
        dsl: run.dsl,
        steps: run.steps,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      },
    };

    if (options?.includeWorkspace !== false) {
      try {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          const tabs = getTabs(mainWindow);
          const workspaceTabs = tabs.map(tab => {
            try {
              return {
                id: tab.id,
                url: tab.view.webContents.getURL() || 'about:blank',
                title: tab.view.webContents.getTitle() || 'New Tab',
                containerId: tab.containerId,
              };
            } catch {
              return {
                id: tab.id,
                url: 'about:blank',
                title: 'New Tab',
                containerId: tab.containerId,
              };
            }
          });
          if (workspaceTabs.length > 0) {
            bundle.workspace = {
              tabs: workspaceTabs,
              activeTabId: getActiveTabIdForWindow(mainWindow.id) ?? undefined,
            };
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SessionBundle] Unable to capture workspace for bundle export:', error);
        }
      }
    }

    // TODO: Include artifacts

    const bundleJson = JSON.stringify(bundle, null, 2);
    const filename = `${bundle.metadata.id}.obtask`;
    const filePath = path.join(this.storagePath, filename);

    await fs.writeFile(filePath, bundleJson, 'utf-8');
    return filePath;
  }

  /**
   * Import and replay bundle
   */
  async importBundle(filePath: string): Promise<SessionBundle> {
    const content = await fs.readFile(filePath, 'utf-8');
    const bundle = JSON.parse(content) as SessionBundle;

    // Validate bundle structure
    if (bundle.version !== '1.0') {
      throw new Error(`Unsupported bundle version: ${bundle.version}`);
    }

    return bundle;
  }

  /**
   * Replay bundle (restore workspace, optionally replay agent)
   */
  async replayBundle(
    bundle: SessionBundle,
    options?: { restoreWorkspace?: boolean; replayAgent?: boolean }
  ): Promise<{ workspaceId?: string; runId?: string }> {
    const result: { workspaceId?: string; runId?: string } = {};

    if (bundle.workspace && options?.restoreWorkspace) {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        throw new Error('No window available to restore workspace');
      }

      try {
        mainWindow.webContents.send('session:restoring', true);
      } catch {}

      try {
        closeAllTabs(mainWindow);
        const createdIds: string[] = [];
        for (const tab of bundle.workspace.tabs) {
          const created = await createTabOnWindow(mainWindow, {
            id: tab.id,
            url: tab.url,
            containerId: tab.containerId,
            activate: false,
          });
          createdIds.push(created.id);
        }
        const targetId =
          (bundle.workspace.activeTabId && createdIds.includes(bundle.workspace.activeTabId)
            ? bundle.workspace.activeTabId
            : createdIds[0]) || null;
        if (targetId) {
          activateTabByWindowId(mainWindow.id, targetId);
        }
        result.workspaceId = 'main';
      } finally {
        try {
          mainWindow.webContents.send('session:restoring', false);
        } catch {}
      }
    }

    // Replay agent if present
    if (bundle.agentRun && options?.replayAgent) {
      // TODO: Replay agent run
      // result.runId = runId;
    }

    return result;
  }

  /**
   * List all bundles
   */
  async listBundles(): Promise<Array<{ id: string; name: string; createdAt: number; path: string }>> {
    try {
      const files = await fs.readdir(this.storagePath);
      const bundles: Array<{ id: string; name: string; createdAt: number; path: string }> = [];

      for (const file of files) {
        if (file.endsWith('.obtask')) {
          const filePath = path.join(this.storagePath, file);
          try {
            const bundle = await this.importBundle(filePath);
            bundles.push({
              id: bundle.metadata.id,
              name: bundle.metadata.name || file,
              createdAt: bundle.metadata.createdAt,
              path: filePath,
            });
          } catch {
            // Skip invalid bundles
          }
        }
      }

      return bundles.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      console.error('[SessionBundle] Failed to create storage directory:', error);
    }
  }
}

// Singleton instance
let sessionBundleInstance: SessionBundleService | null = null;

export function getSessionBundleService(): SessionBundleService {
  if (!sessionBundleInstance) {
    sessionBundleInstance = new SessionBundleService();
  }
  return sessionBundleInstance;
}

