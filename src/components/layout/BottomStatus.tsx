/**
 * BottomStatus - Status bar with live indicators and AI prompt
 */

import { useState, useEffect } from 'react';
import { Lock, Send, Cpu, MemoryStick, Network, Brain, Shield, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { ipc } from '../../lib/ipc-typed';
import { useTabsStore } from '../../state/tabsStore';
import { NetworkStatus } from '../../lib/ipc-events';
import { useIPCEvent } from '../../lib/use-ipc-event';
import { PrivacySwitch } from '../PrivacySwitch';

export function BottomStatus() {
  const { activeId } = useTabsStore();
  const [prompt, setPrompt] = useState('');
  const [dohStatus, setDohStatus] = useState({ enabled: false, provider: 'cloudflare' });
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [modelReady, setModelReady] = useState(true);
  const [privacyMode, setPrivacyMode] = useState<'Normal' | 'Ghost' | 'Tor'>('Normal');

  // Listen for network status
  useIPCEvent<NetworkStatus>('net:status', (status) => {
    if (status.doh) {
      setDohStatus(status.doh);
    }
    if (status.tor?.enabled && status.tor.circuitEstablished) {
      setPrivacyMode('Tor');
    } else if (status.proxy?.enabled) {
      setPrivacyMode('Ghost');
    } else {
      setPrivacyMode('Normal');
    }
  }, []);

  // Update CPU and memory (throttled)
  useEffect(() => {
    const updateSystemStats = async () => {
      try {
        // Would use actual IPC call to get process stats
        // const stats = await ipc.system.getStats();
        // setCpuUsage(stats.cpu);
        // setMemoryUsage(stats.memory);
        
        // Mock for now
        setCpuUsage(Math.floor(Math.random() * 30) + 5);
        setMemoryUsage(Math.floor(Math.random() * 60) + 20);
      } catch {}
    };

    updateSystemStats();
    const interval = setInterval(updateSystemStats, 1000); // Throttled to 1s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Load DoH status
    ipc.dns.status().then(status => {
      setDohStatus(status as any);
    }).catch(() => {});

    // Check model status (would check Ollama heartbeat)
    // ipc.agent.getModelStatus().then(status => {
    //   setModelReady(status.ready);
    // }).catch(() => {});
  }, []);

  const privacyModeColors = {
    Normal: 'text-gray-400',
    Ghost: 'text-blue-400',
    Tor: 'text-purple-400',
  };

  return (
    <div className="h-10 flex items-center justify-between px-4 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700/50">
      {/* Left: Status Indicators */}
      <div className="flex items-center gap-4 text-xs text-gray-300">
        {/* Privacy Mode Switch */}
        <PrivacySwitch />
        
        {/* CPU & Memory Gauges (clickable) */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-1.5 hover:text-gray-200 transition-colors"
          title="Click to open performance inspector"
        >
          <Cpu size={14} className="text-gray-500" />
          <span>CPU: {cpuUsage}%</span>
          <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
              initial={{ width: 0 }}
              animate={{ width: `${cpuUsage}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-1.5 hover:text-gray-200 transition-colors"
          title="Memory usage"
        >
          <MemoryStick size={14} className="text-gray-500" />
          <span>RAM: {memoryUsage}%</span>
          <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${memoryUsage}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.button>

        {/* Network Status */}
        <div className="flex items-center gap-1.5" title={`Network: ${privacyMode} mode`}>
          <Network size={14} className={
            privacyMode === 'Tor' ? 'text-purple-400' :
            privacyMode === 'Ghost' ? 'text-blue-400' :
            'text-gray-500'
          } />
          <span className={privacyModeColors[privacyMode]}>{privacyMode}</span>
        </div>
        
        {/* DoH Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={async () => {
            if (dohStatus.enabled) {
              await ipc.dns.disableDoH();
            } else {
              await ipc.dns.enableDoH('cloudflare');
            }
          }}
          className={`flex items-center gap-1.5 transition-colors ${
            dohStatus.enabled ? 'text-purple-400' : 'text-gray-500'
          } hover:text-gray-200`}
          title="DNS-over-HTTPS"
        >
          <Shield size={14} />
          <span className="text-xs">DoH</span>
        </motion.button>
        
        {/* Model Status */}
        <div className={`flex items-center gap-1.5 ${modelReady ? 'text-green-400' : 'text-yellow-400'}`}>
          <Brain size={14} />
          <span className="text-xs">Model: {modelReady ? 'Ready' : 'Loading...'}</span>
          {modelReady && (
            <motion.div
              className="w-1.5 h-1.5 bg-green-400 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
      </div>

      {/* Right: AI Prompt Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && prompt.trim() && activeId) {
              e.preventDefault();
              try {
                const taskId = await ipc.agent.createTask({
                  title: 'User Prompt',
                  role: 'researcher',
                  goal: prompt,
                  budget: { tokens: 4096, seconds: 120, requests: 20 },
                });
                console.log('Created agent task:', taskId);
                setPrompt('');
              } catch (error) {
                console.error('Failed to create agent task:', error);
              }
            }
          }}
          placeholder="Prompt agent (e.g., 'summarize this page')..."
          className="w-72 h-7 px-3 pr-8 bg-gray-700/60 border border-gray-600/50 rounded text-xs text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
        />
        <button
          onClick={async () => {
            if (prompt.trim() && activeId) {
              try {
                const taskId = await ipc.agent.createTask({
                  title: 'User Prompt',
                  role: 'researcher',
                  goal: prompt,
                  budget: { tokens: 4096, seconds: 120, requests: 20 },
                });
                console.log('Created agent task:', taskId);
                setPrompt('');
              } catch (error) {
                console.error('Failed to create agent task:', error);
              }
            }
          }}
          className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          title="Send prompt"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
