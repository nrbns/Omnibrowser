/**
 * ShieldsPanel - Live blocking stats with real-time counters
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, X, Cookie, Lock, Eye, Wifi, WifiOff } from 'lucide-react';
import { useIPCEvent } from '../lib/use-ipc-event';
import { ipc } from '../lib/ipc-typed';

interface ShieldsCounters {
  ads: number;
  trackers: number;
  cookies3p: boolean;
  httpsUpgrade: boolean;
  webrtcBlocked: boolean;
  fingerprinting: boolean;
}

export function ShieldsPanel() {
  const [counters, setCounters] = useState<ShieldsCounters>({
    ads: 0,
    trackers: 0,
    cookies3p: false,
    httpsUpgrade: false,
    webrtcBlocked: false,
    fingerprinting: false,
  });

  // Listen for shields counter updates
  useIPCEvent<ShieldsCounters>('shields:counters', (data) => {
    setCounters(data);
  }, []);

  useEffect(() => {
    // Load initial shields status
    ipc.shields.getStatus().then((status: any) => {
      if (status) {
        setCounters({
          ads: status.adsBlocked || 0,
          trackers: status.trackersBlocked || 0,
          cookies3p: status.cookies3p === 'block',
          httpsUpgrade: status.httpsUpgrade === true,
          webrtcBlocked: status.webrtcBlocked === true,
          fingerprinting: status.fingerprinting === true,
        });
      }
    }).catch(() => {});
  }, []);

  const stats = [
    { label: 'Ads Blocked', value: counters.ads, icon: X, color: 'text-red-400' },
    { label: 'Trackers Blocked', value: counters.trackers, icon: Shield, color: 'text-orange-400' },
  ];

  const toggles = [
    { label: '3rd-Party Cookies', value: counters.cookies3p, icon: Cookie },
    { label: 'HTTPS Upgrade', value: counters.httpsUpgrade, icon: Lock },
    { label: 'WebRTC Block', value: counters.webrtcBlocked, icon: counters.webrtcBlocked ? WifiOff : Wifi },
    { label: 'Canvas Fingerprint', value: counters.fingerprinting, icon: Eye },
  ];

  return (
    <div className="bg-gray-800/95 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-2xl min-w-[320px]">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="text-blue-400" size={20} />
        <h3 className="font-semibold text-gray-200">Shields</h3>
      </div>

      {/* Live Counters */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={stat.color} size={16} />
                <span className="text-xs text-gray-400">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-200">{stat.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Toggle States */}
      <div className="space-y-2">
        {toggles.map((toggle, idx) => {
          const Icon = toggle.icon;
          return (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
              <div className="flex items-center gap-2">
                <Icon className="text-gray-400" size={16} />
                <span className="text-sm text-gray-300">{toggle.label}</span>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${
                toggle.value ? 'bg-green-500' : 'bg-gray-600'
              }`}>
                <motion.div
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
                  animate={{ x: toggle.value ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

