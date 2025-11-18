/**
 * ModeSwitch - Browser mode selector with grouped secondary modes
 */

import { Brain, TrendingUp, Gamepad2, Zap, FileText, Image, Shield, Network, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../state/appStore';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { trackModeSwitch } from '../../core/supermemory/tracker';

type ModeStatus = 'ready' | 'soon';

type ModeConfig<T extends string> = {
  id: T;
  icon: typeof Zap;
  label: string;
  color: string;
  glowColor: string;
  status: ModeStatus;
  description?: string;
};

// Primary modes - always visible
const primaryModes: ModeConfig<'Browse' | 'Research' | 'Trade'>[] = [
  { id: 'Browse', icon: Zap, label: 'Browse', color: 'text-cyan-400', glowColor: 'from-cyan-500 via-blue-600 to-cyan-500', status: 'ready' },
  { id: 'Research', icon: Brain, label: 'Research', color: 'text-purple-400', glowColor: 'from-purple-500 via-purple-600 to-purple-500', status: 'ready' },
  { id: 'Trade', icon: TrendingUp, label: 'Trade', color: 'text-green-400', glowColor: 'from-green-500 via-emerald-600 to-green-500', status: 'ready' },
];

// Secondary modes - grouped in dropdown
const secondaryModes: ModeConfig<'Games' | 'Docs' | 'Images' | 'Threats' | 'GraphMind'>[] = [
  { id: 'Games', icon: Gamepad2, label: 'Games', color: 'text-yellow-400', glowColor: 'from-yellow-500 via-amber-600 to-yellow-500', status: 'soon', description: 'Arcade layer coming soon' },
  { id: 'Docs', icon: FileText, label: 'Docs', color: 'text-blue-400', glowColor: 'from-blue-500 via-indigo-600 to-blue-500', status: 'soon', description: 'Knowledge workspace in progress' },
  { id: 'Images', icon: Image, label: 'Images', color: 'text-pink-400', glowColor: 'from-pink-500 via-rose-600 to-pink-500', status: 'soon', description: 'AI image search coming soon' },
  { id: 'Threats', icon: Shield, label: 'Threats', color: 'text-red-400', glowColor: 'from-red-500 via-orange-600 to-red-500', status: 'soon', description: 'Threat intelligence dashboard' },
  { id: 'GraphMind', icon: Network, label: 'GraphMind', color: 'text-indigo-400', glowColor: 'from-indigo-500 via-purple-600 to-indigo-500', status: 'soon', description: 'Knowledge graph explorer' },
];

type ModeId = typeof primaryModes[number]['id'] | typeof secondaryModes[number]['id'];

export function ModeSwitch() {
  const { mode, setMode } = useAppStore();
  const navigate = useNavigate();

  const handleModeChange = (newModeId: ModeId) => {
    setMode(newModeId);
    // Track mode switch for analytics
    trackModeSwitch(newModeId).catch(console.error);
    // All modes stay on home page, agent is accessed separately
    navigate('/');
  };

  const currentMode = mode || 'Browse';
  // const isPrimaryMode = primaryModes.some(m => m.id === currentMode); // Unused for now
  const isSecondaryMode = secondaryModes.some(m => m.id === currentMode);
  
  // Find current mode config
  const currentModeConfig = [...primaryModes, ...secondaryModes].find(m => m.id === currentMode);
  const activeSecondaryMode = secondaryModes.find(m => m.id === currentMode);

  return (
    <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1 border border-gray-700/50 shadow-sm">
      {/* Primary modes - always visible */}
      {primaryModes.map((m) => {
        const Icon = m.icon;
        const isActive = currentMode === m.id;
        const isDisabled = m.status !== 'ready';
        
        return (
          <motion.button
            key={m.id}
            onClick={() => !isDisabled && handleModeChange(m.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
              transition-all duration-200 cursor-pointer
              ${isActive
                ? `bg-gradient-to-r ${m.glowColor} text-white shadow-lg`
                : isDisabled
                  ? 'text-gray-500 cursor-not-allowed opacity-60'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
              }
            `}
            title={isDisabled ? `${m.label} (coming soon)` : m.label}
            disabled={isDisabled}
          >
            <Icon size={14} className={isActive ? 'text-white' : m.color} />
            <span className="hidden md:inline">{m.label}</span>
            {isDisabled && (
              <span className="hidden lg:inline text-[10px] uppercase tracking-wide text-slate-400/80">
                Soon
              </span>
            )}
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

      {/* Secondary modes - grouped in dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
              transition-all duration-200 cursor-pointer
              ${isSecondaryMode && currentModeConfig
                ? `bg-gradient-to-r ${currentModeConfig.glowColor} text-white shadow-lg`
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
              }
            `}
            title="More modes"
          >
            {activeSecondaryMode ? (
              <>
                <activeSecondaryMode.icon size={14} className={isSecondaryMode ? 'text-white' : activeSecondaryMode.color} />
                <span className="hidden sm:inline">{activeSecondaryMode.label}</span>
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                <span className="hidden sm:inline">More</span>
              </>
            )}
            {isSecondaryMode && currentModeConfig && (
              <motion.div
                className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${currentModeConfig.glowColor} rounded-full`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
            Additional Modes
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {secondaryModes.map((m) => {
            const Icon = m.icon;
            const isActive = currentMode === m.id;
            const isDisabled = m.status !== 'ready';
            
            return (
              <DropdownMenuItem
                key={m.id}
                onClick={() => !isDisabled && handleModeChange(m.id)}
                className={`
                  flex items-center gap-2 cursor-pointer
                  ${isActive ? 'bg-slate-800/60' : ''}
                  ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}
                `}
                disabled={isDisabled}
              >
                <Icon size={14} className={isActive ? m.color : 'text-slate-400'} />
                <div className="flex flex-col">
                  <span className={isActive ? 'font-semibold' : ''}>{m.label}</span>
                  {isDisabled && (
                    <span className="text-[10px] uppercase text-slate-500 tracking-wide">
                      Coming soon
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

