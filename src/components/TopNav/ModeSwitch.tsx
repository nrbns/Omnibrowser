/**
 * ModeSwitch - Browser mode selector
 */

import { Brain, TrendingUp, Gamepad2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../state/appStore';
import { useNavigate } from 'react-router-dom';

const modes = [
  { id: 'Research', icon: Brain, label: 'Research', color: 'text-purple-400', glowColor: 'from-purple-500 via-purple-600 to-purple-500' },
  { id: 'Trade', icon: TrendingUp, label: 'Trade', color: 'text-green-400', glowColor: 'from-green-500 via-emerald-600 to-green-500' },
  { id: 'Games', icon: Gamepad2, label: 'Game', color: 'text-yellow-400', glowColor: 'from-yellow-500 via-amber-600 to-yellow-500' },
  { id: 'Browse', icon: Zap, label: 'Browse', color: 'text-cyan-400', glowColor: 'from-cyan-500 via-blue-600 to-cyan-500' },
];

export function ModeSwitch() {
  const { mode, setMode } = useAppStore();
  const navigate = useNavigate();

  const handleModeChange = (newMode: typeof modes[number]) => {
    setMode(newMode.id as any);
    // All modes stay on home page, agent is accessed separately
    navigate('/');
  };

  // Map current mode - use mode as-is, default to Research
  const currentMode = mode || 'Research';

  return (
    <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1 border border-gray-700/50 shadow-sm">
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = currentMode === m.id;
        
        return (
          <motion.button
            key={m.id}
            onClick={() => handleModeChange(m)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
              transition-all duration-200 cursor-pointer
              ${isActive
                ? `bg-gradient-to-r ${m.glowColor} text-white shadow-lg`
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
              }
            `}
            title={m.label}
          >
            <Icon size={16} className={isActive ? 'text-white' : m.color} />
            <span>{m.label}</span>
            {isActive && (
              <motion.div
                className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${m.glowColor} rounded-full`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

