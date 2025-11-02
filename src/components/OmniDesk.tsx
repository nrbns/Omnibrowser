/**
 * OmniDesk - Central dashboard for empty state (no tabs open)
 * Think: ChatGPT home + Arc Spaces + Obsidian Quick Launch
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, Search, FileText, Workflow, Clock, Pin, 
  Bot, Zap, BookOpen, TrendingUp, Shield, Network
} from 'lucide-react';
import { useTabsStore } from '../state/tabsStore';
import { useAppStore } from '../state/appStore';
import { ipc } from '../lib/ipc-typed';
import { useNavigate } from 'react-router-dom';

export function OmniDesk() {
  const { tabs } = useTabsStore();
  const { mode, setMode } = useAppStore();
  const navigate = useNavigate();
  const [recentWorkspaces, setRecentWorkspaces] = useState<any[]>([]);
  const [pinnedInsights, setPinnedInsights] = useState<any[]>([]);
  const [continueSessions, setContinueSessions] = useState<any[]>([]);

  useEffect(() => {
    // Load recent workspaces
    ipc.workspaceV2.list().then(result => {
      const workspaces = (result as any)?.workspaces || [];
      setRecentWorkspaces(workspaces.slice(0, 3));
    }).catch(() => {});

    // Load continue sessions (would come from session manager)
    // Mock for now
    setContinueSessions([
      { type: 'Research', title: 'Quantum Computing Research', url: 'about:blank', timestamp: Date.now() - 3600000 },
      { type: 'Trade', title: 'Market Analysis', url: 'about:blank', timestamp: Date.now() - 7200000 },
    ]);
  }, []);

  const quickActions = [
    { icon: Sparkles, label: 'Ask Agent', action: () => navigate('/agent'), color: 'from-blue-500 to-cyan-500' },
    { icon: Search, label: 'Search Topic', action: () => navigate('/search'), color: 'from-purple-500 to-pink-500' },
    { icon: FileText, label: 'Research Notes', action: () => setMode('Research'), color: 'from-green-500 to-emerald-500' },
    { icon: Workflow, label: 'Run Playbook', action: () => navigate('/playbooks'), color: 'from-orange-500 to-red-500' },
  ];

  const handleContinueSession = async (session: any) => {
    if (session.type === 'Research') {
      setMode('Research');
      await ipc.tabs.create(session.url);
    } else if (session.type === 'Trade') {
      setMode('Trade');
      await ipc.tabs.create(session.url);
    }
  };

  if (tabs.length > 0) return null; // Only show when no tabs

  return (
    <div className="h-full w-full bg-gradient-to-br from-[#1A1D28] via-[#1F2332] to-[#1A1D28] flex items-center justify-center p-8 overflow-auto">
      <div className="max-w-5xl w-full space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">
            OmniBrowser
          </h1>
          <p className="text-gray-400">Your intelligent workspace</p>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={idx}
                onClick={action.action}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`p-6 rounded-xl bg-gradient-to-br ${action.color} bg-opacity-10 hover:bg-opacity-20 border border-gray-700/50 backdrop-blur-sm transition-all group`}
              >
                <Icon className="w-8 h-8 mx-auto mb-2 text-gray-300 group-hover:text-white transition-colors" />
                <div className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                  {action.label}
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Continue Sessions */}
        {continueSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Clock size={16} />
              Continue Last Session
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {continueSessions.map((session, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => handleContinueSession(session)}
                  whileHover={{ scale: 1.02, x: 4 }}
                  className="p-4 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-all text-left group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      session.type === 'Research' ? 'bg-purple-500/20 text-purple-400' :
                      session.type === 'Trade' ? 'bg-green-500/20 text-green-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {session.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(session.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                    {session.title}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Workspaces */}
        {recentWorkspaces.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Pin size={16} />
              Recent Workspaces
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {recentWorkspaces.map((workspace, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => navigate(`/w/${workspace.id}`)}
                  whileHover={{ scale: 1.05 }}
                  className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-all"
                >
                  <div className="text-sm font-medium text-gray-200 truncate">
                    {workspace.name}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

