/**
 * PrivacySwitch - Toggle between Normal/Private/Ghost modes
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, Network } from 'lucide-react';
import { ipc } from '../lib/ipc-typed';

type PrivacyMode = 'Normal' | 'Private' | 'Ghost';

export function PrivacySwitch() {
  const [mode, setMode] = useState<PrivacyMode>('Normal');

  const modes: { value: PrivacyMode; icon: typeof Lock; label: string; color: string }[] = [
    { value: 'Normal', icon: Lock, label: 'Normal', color: 'text-gray-400' },
    { value: 'Private', icon: Eye, label: 'Private', color: 'text-blue-400' },
    { value: 'Ghost', icon: Network, label: 'Ghost', color: 'text-purple-400' },
  ];

  const handleModeChange = async (newMode: PrivacyMode) => {
    if (newMode === mode) return;

    if (newMode === 'Private') {
      try {
        if ((window as any).ipc?.invoke) {
          await (window as any).ipc.invoke('ob://ipc/v1/private:createWindow', { url: 'about:blank' });
        }
      } catch (error) {
        console.error('Failed to create private window:', error);
        return;
      }
    } else if (newMode === 'Ghost') {
      try {
        if ((window as any).ipc?.invoke) {
          await (window as any).ipc.invoke('ob://ipc/v1/private:createGhostTab', { url: 'about:blank' });
        }
      } catch (error) {
        console.error('Failed to create ghost tab:', error);
        return;
      }
    }

    setMode(newMode);
  };

  return (
    <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = mode === m.value;
        return (
          <motion.button
            key={m.value}
            onClick={() => handleModeChange(m.value)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              isActive
                ? `${m.color.replace('text-', 'bg-')} bg-opacity-20 text-white`
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            <span>{m.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

