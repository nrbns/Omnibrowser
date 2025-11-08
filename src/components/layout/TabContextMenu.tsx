/**
 * TabContextMenu - Right-click menu for tab actions (Ghost, Burn, etc.)
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ghost, Flame, Clock, Copy, X, Boxes } from 'lucide-react';
import { ipc } from '../../lib/ipc-typed';
import { useProfileStore } from '../../state/profileStore';
import { useContainerStore } from '../../state/containerStore';
import { ContainerInfo } from '../../lib/ipc-events';

interface TabContextMenuProps {
  tabId: string;
  url: string;
  containerId?: string;
  containerName?: string;
  containerColor?: string;
  mode?: 'normal' | 'ghost' | 'private';
  onClose: () => void;
}

export function TabContextMenu({
  tabId,
  url,
  containerId,
  containerName,
  containerColor,
  mode,
  onClose,
}: TabContextMenuProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const policy = useProfileStore((state) => state.policies[state.activeProfileId]);
  const ghostDisabled = policy ? !policy.allowGhostTabs : false;
  const privateDisabled = policy ? !policy.allowPrivateWindows : false;
  const { containers, setContainers } = useContainerStore((state) => ({
    containers: state.containers,
    setContainers: state.setContainers,
  }));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    // Get last right-click position from global state or event
    const storedPos = (window as any).__lastContextMenuPos || { x: 0, y: 0 };
    setPosition({ x: storedPos.x, y: storedPos.y });
  }, []);

  useEffect(() => {
    if (containers.length === 0) {
      ipc.containers
        .list()
        .then((list) => {
          if (Array.isArray(list)) {
            setContainers(list as ContainerInfo[]);
          }
        })
        .catch((error) => {
          console.error('Failed to load containers for context menu:', error);
        });
    }
  }, [containers.length, setContainers]);

  const handleOpenAsGhost = async () => {
    if (ghostDisabled) return;
    try {
      await ipc.private.createGhostTab({ url });
      onClose();
    } catch (error) {
      console.error('Failed to open as ghost:', error);
    }
  };

  const handleBurnTab = async () => {
    try {
      if (confirm('Burn this tab? All data will be permanently deleted.')) {
        await ipc.tabs.burn(tabId);
        onClose();
      }
    } catch (error) {
      console.error('Failed to burn tab:', error);
    }
  };

  const handleStartTimer = async () => {
    if (privateDisabled) return;
    const minutes = prompt('Auto-close after (minutes):', '10');
    if (minutes) {
      try {
        const ms = parseInt(minutes) * 60 * 1000;
        await ipc.private.createWindow({ url, autoCloseAfter: ms });
        onClose();
      } catch (error) {
        console.error('Failed to start timer:', error);
      }
    }
  };

  const handleDuplicate = async () => {
    try {
      await ipc.tabs.create({ url: url || 'about:blank', containerId });
      onClose();
    } catch (error) {
      console.error('Failed to duplicate tab:', error);
    }
  };

  const handleMoveToContainer = async (targetId: string) => {
    if (!targetId || targetId === containerId) {
      onClose();
      return;
    }
    try {
      const result = await ipc.tabs.setContainer(tabId, targetId);
      if (!result?.success) {
        console.warn('Failed to switch container:', result?.error);
      }
    } catch (error) {
      console.error('Failed to switch tab container:', error);
    } finally {
      onClose();
    }
  };

  const isGhost = mode === 'ghost';
  const isPrivate = mode === 'private';

  const menuItems = [
    { icon: Copy, label: 'Duplicate Tab', action: handleDuplicate, disabled: isGhost || isPrivate },
    {
      icon: Ghost,
      label: 'Open as Ghost',
      action: handleOpenAsGhost,
      hide: isGhost,
      disabled: ghostDisabled,
      disabledReason: 'Disabled by profile policy',
    },
    { icon: Flame, label: 'Burn Tab', action: handleBurnTab, danger: true },
    {
      icon: Clock,
      label: 'Start 10-min Timer',
      action: handleStartTimer,
      disabled: privateDisabled,
      disabledReason: 'Disabled by profile policy',
    },
  ].filter(item => !item.hide);

  const moveTargets = !isGhost && !isPrivate
    ? containers.filter((c: ContainerInfo) => c.id !== containerId)
    : [];

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 bg-gray-800/95 backdrop-blur-md border border-gray-700/50 rounded-lg shadow-xl py-1 min-w-[180px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        {(containerId || containerName) && (
          <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-800/50 flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full border border-gray-700/60"
              style={{ backgroundColor: containerColor || '#6366f1' }}
            />
            <span>{containerName || (containerId === 'default' ? 'Default container' : containerId)}</span>
          </div>
        )}

        {menuItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={idx}
              whileHover={item.disabled ? undefined : { scale: 1.01 }}
              onClick={item.action}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                item.danger
                  ? 'text-red-400 hover:text-red-300'
                  : item.disabled
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-gray-300 hover:text-gray-100'
              }`}
              disabled={item.disabled}
              title={
                item.disabled
                  ? item.disabledReason || 'Disabled by profile policy'
                  : undefined
              }
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </motion.button>
          );
        })}

        {moveTargets.length > 0 && (
          <div className="mt-1 border-t border-gray-800/60 pt-1.5">
            <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-gray-500 flex items-center gap-2">
              <Boxes size={12} />
              Move to container
            </div>
            <div className="flex flex-col">
              {moveTargets.map((container) => (
                <motion.button
                  key={container.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => handleMoveToContainer(container.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-800/40 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-gray-700/60"
                    style={{ backgroundColor: container.color || '#6366f1' }}
                  />
                  <span className="truncate">{container.name}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

