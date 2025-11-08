import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Boxes, Plus } from 'lucide-react';
import { ipc } from '../../lib/ipc-typed';
import { useContainerStore } from '../../state/containerStore';
import { ContainerInfo } from '../../lib/ipc-events';
import { ipcEvents } from '../../lib/ipc-events';

type PermissionKey = 'media' | 'display-capture' | 'notifications' | 'fullscreen';

const PERMISSION_OPTIONS: Array<{ key: PermissionKey; label: string; description: string }> = [
  {
    key: 'media',
    label: 'Camera & microphone',
    description: 'Allow access to audio / video input devices.',
  },
  {
    key: 'display-capture',
    label: 'Screen capture',
    description: 'Enable screen or window sharing requests.',
  },
  {
    key: 'notifications',
    label: 'Desktop notifications',
    description: 'Permit this container to show system notifications.',
  },
  {
    key: 'fullscreen',
    label: 'Fullscreen & PIP',
    description: 'Allow fullscreen transitions and picture-in-picture.',
  },
];

export function ContainerSwitcher() {
  const { containers, activeContainerId, setContainers, setActiveContainer } = useContainerStore();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#22c55e');
  const [permissionState, setPermissionState] = useState<Record<string, string[]>>({});
  const [sitePermissionState, setSitePermissionState] = useState<
    Record<string, Array<{ permission: PermissionKey; origins: string[] }>>
  >({});

  const fetchPermissions = useCallback(async (containerId: string): Promise<string[]> => {
    try {
      const response = await ipc.containers.getPermissions(containerId);
      return Array.isArray(response?.permissions) ? response.permissions : [];
    } catch (error) {
      console.error('Failed to fetch container permissions:', error);
      return [];
    }
  }, []);

  const loadContainers = useCallback(async () => {
    try {
      const [list, active] = await Promise.all([
        ipc.containers.list(),
        ipc.containers.getActive(),
      ]);

      if (Array.isArray(list)) {
        const typedList = list as ContainerInfo[];
        setContainers(typedList);
        const permissionEntries = await Promise.all(
          typedList.map((container) => fetchPermissions(container.id))
        );
        const map: Record<string, string[]> = {};
        typedList.forEach((container, index) => {
          map[container.id] = permissionEntries[index] ?? [];
        });
        setPermissionState(map);
      }

      if (active) {
        setActiveContainer(active as ContainerInfo);
        await refreshPermissionState(active.id);
        await refreshSitePermissions(active.id);
      }
    } catch (error) {
      console.error('Failed to load containers:', error);
    }
  }, [fetchPermissions, refreshPermissionState, refreshSitePermissions, setActiveContainer, setContainers]);

  useEffect(() => {
    void loadContainers();
  }, [loadContainers]);

  useEffect(() => {
    const unsubscribeSite = ipcEvents.on<{ containerId: string; permission: PermissionKey; origins: string[] }>(
      'containers:sitePermissions',
      (payload) => {
        if (!payload?.containerId) return;
        setSitePermissionState((prev) => ({
          ...prev,
          [payload.containerId]: [
            ...(prev[payload.containerId]?.filter((entry) => entry.permission !== payload.permission) ?? []),
            { permission: payload.permission, origins: payload.origins },
          ],
        }));
      },
    );
    return () => {
      unsubscribeSite();
    };
  }, []);

  const refreshPermissionState = useCallback(async (containerId: string) => {
    const permissions = await fetchPermissions(containerId);
    setPermissionState((prev) => ({
      ...prev,
      [containerId]: permissions,
    }));
  }, [fetchPermissions]);

  const refreshSitePermissions = useCallback(async (containerId: string) => {
    try {
      const entries = await ipc.containers.getSitePermissions(containerId);
      if (Array.isArray(entries)) {
        setSitePermissionState((prev) => ({
          ...prev,
          [containerId]: entries as Array<{ permission: PermissionKey; origins: string[] }>,
        }));
      }
    } catch (error) {
      console.error('Failed to load site permissions:', error);
    }
  }, []);

  const handleSelect = async (container: ContainerInfo) => {
    try {
      const active = await ipc.containers.setActive(container.id);
      if (active) {
        setActiveContainer(active as ContainerInfo);
      } else {
        setActiveContainer(container);
      }
      await refreshPermissionState(container.id);
      await refreshSitePermissions(container.id);
      setOpen(false);
    } catch (error) {
      console.error('Failed to set active container:', error);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const container = await ipc.containers.create({ name: name.trim(), color });
      if (container) {
        await loadContainers();
        await refreshPermissionState(container.id);
        await refreshSitePermissions(container.id);
      }
      setName('');
      setCreating(false);
      setOpen(false);
    } catch (error) {
      console.error('Failed to create container:', error);
    }
  };

  const activeContainer = containers.find((c) => c.id === activeContainerId);
  const activePermissions = activeContainer ? permissionState[activeContainer.id] ?? [] : [];
  const sitePermissionEntries = activeContainer ? sitePermissionState[activeContainer.id] ?? [] : [];
  const originsForPermission = (permission: PermissionKey) =>
    sitePermissionEntries.find((entry) => entry.permission === permission)?.origins ?? [];

  const handleTogglePermission = async (permissionKey: PermissionKey) => {
    if (!activeContainer) return;
    const enabled = activePermissions.includes(permissionKey);
    try {
      const response = await ipc.containers.setPermission(activeContainer.id, permissionKey, !enabled);
      setPermissionState((prev) => ({
        ...prev,
        [activeContainer.id]: Array.isArray(response?.permissions) ? response.permissions : [],
      }));
      await refreshSitePermissions(activeContainer.id);
    } catch (error) {
      console.error('Failed to update container permission:', error);
    }
  };

  const handleRemoveOrigin = async (permissionKey: PermissionKey, origin: string) => {
    if (!activeContainer) return;
    try {
      const entries = await ipc.containers.revokeSitePermission(activeContainer.id, permissionKey, origin);
      if (Array.isArray(entries)) {
        setSitePermissionState((prev) => ({
          ...prev,
          [activeContainer.id]: entries as Array<{ permission: PermissionKey; origins: string[] }>,
        }));
      }
    } catch (error) {
      console.error('Failed to revoke site permission:', error);
    }
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-800/80 border border-gray-700/50 text-gray-300 hover:text-gray-100 transition-all"
        title="Container (isolated storage)"
      >
        <Boxes size={16} />
        <span className="text-sm font-medium">{activeContainer?.name || 'Default'}</span>
        {activeContainer?.color && (
          <div
            className="w-3 h-3 rounded-full border border-gray-700"
            style={{ backgroundColor: activeContainer.color }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 w-72 bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-lg shadow-xl overflow-hidden z-40"
          >
            <div className="p-3 border-b border-gray-800/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">Containers</h3>
              <button
                onClick={() => {
                  setCreating(true);
                  setName('');
                  setColor('#22c55e');
                }}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {creating && (
                <div className="p-3 border-b border-gray-800/50">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Container name"
                    autoFocus
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs text-gray-400">Color</label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-7 w-16 bg-transparent border border-gray-700 rounded"
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleCreate}
                      className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setCreating(false);
                        setName('');
                      }}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {containers.map((container) => {
                const isActive = container.id === activeContainerId;
                return (
                  <button
                    key={container.id}
                    onClick={() => handleSelect(container)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left border-b border-gray-800/50 transition-colors ${
                      isActive ? 'bg-blue-600/20 border-blue-500/30' : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-gray-700"
                      style={{ backgroundColor: container.color }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-200 truncate">{container.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {container.scope ? `${container.scope.charAt(0).toUpperCase()}${container.scope.slice(1)} scope` : 'Session scope'}
                      </div>
                    </div>
                    {isActive && <span className="text-xs text-blue-400">Active</span>}
                  </button>
                );
              })}

              {containers.length === 0 && !creating && (
                <div className="p-3 text-xs text-gray-500">No containers yet</div>
              )}
            </div>

            {activeContainer && (
              <div className="border-t border-gray-800/50 bg-gray-900/60 p-3">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  Permissions for {activeContainer.name}
                </span>
                <div className="mt-3 space-y-3">
                  {PERMISSION_OPTIONS.map((option) => {
                    const enabled = activePermissions.includes(option.key);
                    return (
                      <label
                        key={option.key}
                        className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 hover:border-gray-700/60 hover:bg-gray-800/40 transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                          checked={enabled}
                          onChange={() => handleTogglePermission(option.key)}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="text-sm font-medium text-gray-200">
                            {option.label}
                          </div>
                          <p className="text-xs text-gray-500 leading-snug">
                            {option.description}
                          </p>
                      {originsForPermission(option.key).length > 0 && (
                        <div className="mt-2 space-y-1">
                          <span className="text-[11px] uppercase tracking-wide text-gray-500">
                            Allowed sites
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {originsForPermission(option.key).map((origin) => (
                              <span
                                key={`${option.key}-${origin}`}
                                className="group inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[11px] text-gray-300"
                                title={origin}
                              >
                                <span className="max-w-[140px] truncate">{origin.replace(/^https?:\/\//, '')}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleRemoveOrigin(option.key, origin);
                                  }}
                                  className="rounded-full bg-transparent p-0.5 text-gray-500 hover:bg-gray-700 hover:text-gray-200 transition-colors"
                                  aria-label={`Remove ${origin} from ${option.label}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-3 border-t border-gray-800/50 bg-gray-900/50">
              <p className="text-xs text-gray-500">
                Containers isolate cookies, storage, and login state per tab.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


