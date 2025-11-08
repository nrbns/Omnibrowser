import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { registerHandler } from '../shared/ipc/router';
import {
  ContainerCreateRequest,
  ContainerPermissionSetRequest,
  ContainerPermissionsResponse,
  ContainerSetActiveRequest,
} from '../shared/ipc/schema';

export type ContainerScope = 'global' | 'session' | 'ephemeral';
export type ContainerPermission = 'media' | 'display-capture' | 'notifications' | 'fullscreen';

const DEFAULT_ALLOWED_PERMISSIONS: ContainerPermission[] = [
  'media',
  'display-capture',
  'notifications',
  'fullscreen',
];

export interface ContainerProfile {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  scope: ContainerScope;
  persistent: boolean;
  system?: boolean;
}

export interface ResolveContainerPartitionParams {
  containerId?: string;
  sessionPartition?: string;
  sessionId?: string;
  tabId: string;
}

export interface ContainerPartitionResult {
  container: ContainerProfile;
  basePartition: string;
  deriveSitePartition: boolean;
  partitionOptions?: Electron.FromPartitionOptions;
}

const BUILT_IN_CONTAINERS: ContainerProfile[] = [
  {
    id: 'default',
    name: 'Default',
    color: '#3b82f6',
    icon: 'globe',
    description: 'Shared browsing context',
    scope: 'session',
    persistent: true,
    system: true,
  },
  {
    id: 'work',
    name: 'Work',
    color: '#6366f1',
    icon: 'briefcase',
    description: 'Isolated work logins and apps',
    scope: 'session',
    persistent: true,
    system: true,
  },
  {
    id: 'personal',
    name: 'Personal',
    color: '#f472b6',
    icon: 'user',
    description: 'Personal browsing with separate cookies',
    scope: 'session',
    persistent: true,
    system: true,
  },
  {
    id: 'stealth',
    name: 'Stealth',
    color: '#f97316',
    icon: 'eye-off',
    description: 'Ephemeral container for sensitive or AI fetches',
    scope: 'ephemeral',
    persistent: false,
    system: true,
  },
];

class ContainerManager extends EventEmitter {
  private containers = new Map<string, ContainerProfile>();
  private permissions = new Map<string, Set<ContainerPermission>>();
  private sitePermissions = new Map<string, Map<ContainerPermission, Set<string>>>();
  private activeByWindow = new Map<number, string>();

  constructor() {
    super();
    BUILT_IN_CONTAINERS.forEach((container) => {
      this.containers.set(container.id, container);
      this.ensurePermissions(container.id);
    });
  }

  private ensurePermissions(containerId: string): Set<ContainerPermission> {
    if (!this.permissions.has(containerId)) {
      this.permissions.set(containerId, new Set(DEFAULT_ALLOWED_PERMISSIONS));
    }
    return this.permissions.get(containerId)!;
  }

  private ensureSitePermissions(containerId: string): Map<ContainerPermission, Set<string>> {
    if (!this.sitePermissions.has(containerId)) {
      const map = new Map<ContainerPermission, Set<string>>();
      DEFAULT_ALLOWED_PERMISSIONS.forEach((permission) => {
        map.set(permission, new Set());
      });
      this.sitePermissions.set(containerId, map);
    }
    const map = this.sitePermissions.get(containerId)!;
    DEFAULT_ALLOWED_PERMISSIONS.forEach((permission) => {
      if (!map.has(permission)) {
        map.set(permission, new Set());
      }
    });
    return map;
  }

  getContainer(containerId?: string): ContainerProfile {
    if (containerId && this.containers.has(containerId)) {
      return this.containers.get(containerId)!;
    }
    return this.containers.get('default')!;
  }

  list(): ContainerProfile[] {
    return Array.from(this.containers.values());
  }

  createContainer(name: string, color?: string, icon?: string): ContainerProfile {
    const id = randomUUID();
    const container: ContainerProfile = {
      id,
      name,
      color: color || '#22d3ee',
      icon,
      scope: 'session',
      persistent: false,
    };
    this.containers.set(container.id, container);
    this.ensurePermissions(container.id);
    this.ensureSitePermissions(container.id);
    this.emit('containers:updated', this.list());
    return container;
  }

  getPermissions(containerId: string): ContainerPermission[] {
    return Array.from(this.ensurePermissions(containerId));
  }

  setPermission(containerId: string, permission: ContainerPermission, enabled: boolean): ContainerPermission[] {
    const set = this.ensurePermissions(containerId);
    if (enabled) {
      set.add(permission);
    } else {
      set.delete(permission);
    }
    const permissions = Array.from(set);
    this.emit('containers:permissionsChanged', { containerId, permissions });
    return permissions;
  }

  isPermissionAllowed(containerId: string | undefined, permission: string): boolean {
    if (!permission) return false;
    const set = this.ensurePermissions(containerId || 'default');
    return set.has(permission as ContainerPermission);
  }

  hasSitePermission(containerId: string, permission: ContainerPermission, origin: string): boolean {
    const siteMap = this.ensureSitePermissions(containerId);
    return siteMap.get(permission)?.has(origin) ?? false;
  }

  recordSitePermission(containerId: string, permission: ContainerPermission, origin: string): void {
    const siteMap = this.ensureSitePermissions(containerId);
    const set = siteMap.get(permission);
    if (!set) return;
    if (!set.has(origin)) {
      set.add(origin);
      this.emit('containers:sitePermissionsChanged', {
        containerId,
        permission,
        origins: Array.from(set),
      });
    }
  }

  removeSitePermission(containerId: string, permission: ContainerPermission, origin: string): void {
    const siteMap = this.ensureSitePermissions(containerId);
    const set = siteMap.get(permission);
    if (!set) return;
    if (set.delete(origin)) {
      this.emit('containers:sitePermissionsChanged', {
        containerId,
        permission,
        origins: Array.from(set),
      });
    }
  }

  listSitePermissions(containerId: string): Array<{ permission: ContainerPermission; origins: string[] }> {
    const siteMap = this.ensureSitePermissions(containerId);
    const entries: Array<{ permission: ContainerPermission; origins: string[] }> = [];
    for (const [permission, set] of siteMap.entries()) {
      entries.push({ permission, origins: Array.from(set) });
    }
    return entries;
  }

  getActiveForWindow(win: BrowserWindow): ContainerProfile {
    const currentId = this.activeByWindow.get(win.id);
    const container = this.getContainer(currentId);
    this.activeByWindow.set(win.id, container.id);
    (win as any).__ob_defaultContainerId = container.id;
    return container;
  }

  setActiveForWindow(win: BrowserWindow, containerId?: string): ContainerProfile {
    const container = this.getContainer(containerId);
    this.activeByWindow.set(win.id, container.id);
    (win as any).__ob_defaultContainerId = container.id;
    this.emit('containers:activeChanged', { windowId: win.id, containerId: container.id });
    return container;
  }

  removeWindow(winId: number) {
    this.activeByWindow.delete(winId);
  }

  resolvePartition(params: ResolveContainerPartitionParams): ContainerPartitionResult {
    const container = this.getContainer(params.containerId);

    if (container.scope === 'ephemeral') {
      const basePartition = `temp:container:${container.id}:${params.tabId}`;
      return {
        container,
        basePartition,
        deriveSitePartition: false,
        partitionOptions: { cache: false },
      };
    }

    if (container.scope === 'global') {
      const basePartition = `persist:container:${container.id}`;
      return {
        container,
        basePartition,
        deriveSitePartition: true,
      };
    }

    // session-scoped (default for built-ins)
    const sessionPartition = params.sessionPartition || 'persist:default';
    const basePartition = `${sessionPartition}:container:${container.id}`;
    return {
      container,
      basePartition,
      deriveSitePartition: true,
    };
  }
}

let containerManagerInstance: ContainerManager | null = null;

export function getContainerManager(): ContainerManager {
  if (!containerManagerInstance) {
    containerManagerInstance = new ContainerManager();
  }
  return containerManagerInstance;
}

export function registerContainersIpc() {
  const manager = getContainerManager();

  manager.on('containers:sitePermissionsChanged', (payload: { containerId: string; permission: ContainerPermission; origins: string[] }) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send('containers:sitePermissions', payload);
        } catch {}
      }
    });
  });

  registerHandler('containers:list', z.object({}), async () => {
    return manager.list().map((container) => ({
      ...container,
      partition: container.scope === 'ephemeral'
        ? `temp:container:${container.id}`
        : `persist:container:${container.id}`,
      createdAt: Date.now(),
    }));
  });

  registerHandler('containers:getActive', z.object({}), async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return manager.getContainer();
    }
    return manager.getActiveForWindow(win);
  });

  registerHandler('containers:setActive', ContainerSetActiveRequest, async (event, request) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      throw new Error('No window available for container switch');
    }
    const container = manager.setActiveForWindow(win, request.containerId);
    try {
      win.webContents.send('containers:active', {
        containerId: container.id,
        container,
      });
      const entries = manager.listSitePermissions(container.id);
      for (const entry of entries) {
        try {
          win.webContents.send('containers:sitePermissions', {
            containerId: container.id,
            permission: entry.permission,
            origins: entry.origins,
          });
        } catch {}
      }
    } catch {}
    return container;
  });

  registerHandler('containers:create', ContainerCreateRequest, async (event, request) => {
    const container = manager.createContainer(request.name, request.color, request.icon);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      manager.setActiveForWindow(win, container.id);
      try {
        win.webContents.send('containers:list', manager.list());
        win.webContents.send('containers:active', { containerId: container.id, container });
        const entries = manager.listSitePermissions(container.id);
        for (const entry of entries) {
          win.webContents.send('containers:sitePermissions', {
            containerId: container.id,
            permission: entry.permission,
            origins: entry.origins,
          });
        }
      } catch {}
    }
    return container;
  });

  registerHandler('containers:getPermissions', z.object({ containerId: z.string() }), async (_event, request) => {
    const response: z.infer<typeof ContainerPermissionsResponse> = {
      containerId: request.containerId,
      permissions: manager.getPermissions(request.containerId),
    };
    return response;
  });

  registerHandler('containers:setPermission', ContainerPermissionSetRequest, async (_event, request) => {
    const permissions = manager.setPermission(request.containerId, request.permission, request.enabled);
    const response: z.infer<typeof ContainerPermissionsResponse> = {
      containerId: request.containerId,
      permissions,
    };
    return response;
  });

  registerHandler('containers:getSitePermissions', z.object({ containerId: z.string() }), async (_event, request) => {
    return manager.listSitePermissions(request.containerId);
  });

  registerHandler('containers:revokeSitePermission', z.object({
    containerId: z.string(),
    permission: z.enum(['media', 'display-capture', 'notifications', 'fullscreen']),
    origin: z.string(),
  }), async (_event, request) => {
    manager.removeSitePermission(request.containerId, request.permission, request.origin);
    return manager.listSitePermissions(request.containerId);
  });
}

