/**
 * QuickActions - Top-right action buttons (screenshot, inspect, cast, translate, reader, pin)
 */

import { useState } from 'react';
import { Camera, Code, Cast, Languages, FileText, Pin, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabsStore } from '../../state/tabsStore';
import { ipc } from '../../lib/ipc-typed';

interface QuickActionsProps {
  onReaderToggle?: () => void;
}

export function QuickActions({ onReaderToggle }: QuickActionsProps) {
  const { activeId } = useTabsStore();
  const [isPinned, setIsPinned] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleScreenshot = async () => {
    if (!activeId) return;
    try {
      const result = await ipc.tabs.screenshot(activeId);
      if (result?.success) {
        console.log('Screenshot saved:', result.path);
      } else {
        console.error('Screenshot failed:', result?.error);
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  };

  const handleInspect = async () => {
    if (!activeId) return;
    try {
      await ipc.tabs.devtools(activeId);
    } catch (error) {
      console.error('Failed to open DevTools:', error);
    }
  };

  const handleCast = () => {
    console.log('Cast/Mirror not implemented yet');
  };

  const handleTranslate = () => {
    console.log('Translate not implemented yet');
  };

  const handleReader = () => {
    onReaderToggle?.();
  };

  const handlePin = () => {
    setIsPinned(!isPinned);
    // Would call IPC to pin tab
  };

  const actions = [
    { icon: Camera, label: 'Screenshot', onClick: handleScreenshot, shortcut: 'Ctrl+Shift+S' },
    { icon: Code, label: 'Inspect', onClick: handleInspect, shortcut: 'F12' },
    { icon: Cast, label: 'Cast', onClick: handleCast },
    { icon: Languages, label: 'Translate', onClick: handleTranslate },
    { icon: FileText, label: 'Reader', onClick: handleReader },
    { icon: Pin, label: isPinned ? 'Unpin' : 'Pin', onClick: handlePin, active: isPinned },
  ];

  return (
    <div className="flex items-center gap-1">
      {actions.slice(0, 3).map((action, idx) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={idx}
            onClick={action.onClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`p-1.5 rounded-md hover:bg-gray-700/50 transition-colors ${
              action.active ? 'text-blue-400 bg-blue-500/20' : 'text-gray-400'
            }`}
            title={action.label + (action.shortcut ? ` (${action.shortcut})` : '')}
          >
            <Icon size={16} />
          </motion.button>
        );
      })}

      <div className="relative">
        <motion.button
          onClick={() => setMenuOpen(!menuOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-1.5 rounded-md hover:bg-gray-700/50 text-gray-400 transition-colors"
          title="More actions"
        >
          <MoreVertical size={16} />
        </motion.button>

        <AnimatePresence>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[180px] py-1"
              >
                {actions.slice(3).map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        action.onClick();
                        setMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700/50 transition-colors ${
                        action.active ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{action.label}</span>
                      {action.shortcut && (
                        <span className="ml-auto text-xs text-gray-500">{action.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

