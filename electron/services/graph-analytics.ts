import { BrowserWindow } from 'electron';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { getTabs } from './tabs';

interface TabGraphNode {
  id: string;
  title: string;
  url: string;
  domain: string;
  containerId?: string;
  containerName?: string;
  containerColor?: string;
  mode?: 'normal' | 'ghost' | 'private';
  active: boolean;
  createdAt?: number;
  lastActiveAt?: number;
}

interface TabGraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  reasons: string[];
}

interface TabGraphSummary {
  totalTabs: number;
  activeTabs: number;
  domains: number;
  containers: number;
}

interface TabGraphPayload {
  nodes: TabGraphNode[];
  edges: TabGraphEdge[];
  summary: TabGraphSummary;
  updatedAt: number;
}

const getDomain = (url?: string | null): string => {
  if (!url) return 'unknown';
  try {
    const parsed = new URL(url);
    return parsed.hostname || 'unknown';
  } catch {
    return 'unknown';
  }
};

const edgeKey = (a: string, b: string): string => {
  if (a === b) return `${a}__${b}`;
  return a < b ? `${a}__${b}` : `${b}__${a}`;
};

export function registerGraphAnalyticsIpc(): void {
  registerHandler(
    'graph:tabs',
    z.object({}),
    async () => {
      const nodes: TabGraphNode[] = [];
      const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
      const containerSet = new Set<string>();
      const domainSet = new Set<string>();
      let activeCount = 0;

      for (const win of windows) {
        const tabs = getTabs(win);
        tabs.forEach((tab) => {
          const domain = getDomain(tab.url);
          const node: TabGraphNode = {
            id: tab.id,
            title: tab.title || domain || 'Untitled tab',
            url: tab.url || 'about:blank',
            domain,
            containerId: tab.containerId || undefined,
            containerName: tab.containerName || undefined,
            containerColor: tab.containerColor || undefined,
            mode: tab.mode,
            active: Boolean(tab.active),
            createdAt: tab.createdAt,
            lastActiveAt: tab.lastActiveAt,
          };
          nodes.push(node);
          if (node.containerId) {
            containerSet.add(node.containerId);
          }
          if (domain) {
            domainSet.add(domain);
          }
          if (node.active) {
            activeCount += 1;
          }
        });
      }

      const edgesMap = new Map<string, { source: string; target: string; weight: number; reasons: Set<string> }>();

      const addEdge = (source: string, target: string, reason: string, weight = 1) => {
        if (source === target) return;
        const key = edgeKey(source, target);
        const entry = edgesMap.get(key);
        if (entry) {
          entry.weight += weight;
          entry.reasons.add(reason);
        } else {
          edgesMap.set(key, {
            source,
            target,
            weight,
            reasons: new Set([reason]),
          });
        }
      };

      // Pairwise checks
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.domain && a.domain === b.domain) {
            addEdge(a.id, b.id, 'domain', 2);
          }
          if (a.containerId && a.containerId === b.containerId) {
            addEdge(a.id, b.id, 'container', 1.5);
          }
          if (a.mode && a.mode === b.mode) {
            addEdge(a.id, b.id, 'mode', 1);
          }
          if (typeof a.lastActiveAt === 'number' && typeof b.lastActiveAt === 'number') {
            const delta = Math.abs(a.lastActiveAt - b.lastActiveAt);
            if (delta <= 120_000) {
              addEdge(a.id, b.id, 'timeline', 0.5);
            }
          }
        }
      }

      const edges: TabGraphEdge[] = Array.from(edgesMap.values()).map((entry) => ({
        id: `${entry.source}->${entry.target}`,
        source: entry.source,
        target: entry.target,
        weight: Number(entry.weight.toFixed(2)),
        reasons: Array.from(entry.reasons.values()),
      }));

      const payload: TabGraphPayload = {
        nodes,
        edges,
        updatedAt: Date.now(),
        summary: {
          totalTabs: nodes.length,
          activeTabs: activeCount,
          domains: domainSet.size,
          containers: containerSet.size,
        },
      };

      return payload;
    },
  );
}
