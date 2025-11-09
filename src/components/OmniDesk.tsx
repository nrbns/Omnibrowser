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
import { ipcEvents } from '../lib/ipc-events';

export function OmniDesk() {
  const { tabs, activeId } = useTabsStore();
  const { mode, setMode } = useAppStore();
  const navigate = useNavigate();
  const [recentWorkspaces, setRecentWorkspaces] = useState<any[]>([]);
  const [pinnedInsights, setPinnedInsights] = useState<any[]>([]);
  const [continueSessions, setContinueSessions] = useState<any[]>([]);

  // Load workspace and session data
  useEffect(() => {
    const loadData = async () => {
      // Wait for IPC to be ready
      if (!window.ipc || typeof window.ipc.invoke !== 'function') {
        // Retry after a delay
        setTimeout(loadData, 500);
        return;
      }
      
      try {
        // Load recent workspaces
        const workspaceResult = await ipc.workspaceV2.list();
        const workspaces = (workspaceResult as any)?.workspaces || [];
        setRecentWorkspaces(workspaces.slice(0, 3));
      } catch {
        // Silently handle - will retry if needed
      }

      try {
        // Load recent sessions from session manager
        const sessionsResult = await ipc.sessions.list();
        const sessions = (sessionsResult as any) || [];
        
        // Transform sessions into continue format
        const continueItems = sessions
          .slice(0, 2)
          .map((session: any) => ({
            id: session.id,
            type: session.name?.includes('Research') ? 'Research' : 
                  session.name?.includes('Trade') ? 'Trade' : 'Browse',
            title: session.name || 'Untitled Session',
            url: 'about:blank',
            timestamp: session.createdAt || Date.now() - 3600000,
            sessionId: session.id
          }));
        
        if (continueItems.length > 0) {
          setContinueSessions(continueItems);
        } else {
          // Fallback: Show mock sessions if none exist
          setContinueSessions([
            { 
              type: 'Research', 
              title: 'Quantum Computing Research', 
              url: 'about:blank', 
              timestamp: Date.now() - 3600000 
            },
            { 
              type: 'Trade', 
              title: 'Market Analysis', 
              url: 'about:blank', 
              timestamp: Date.now() - 7200000 
            },
          ]);
        }
      } catch {
        // Silently handle - will retry if needed
        // Fallback to mock data
        setContinueSessions([
          { 
            type: 'Research', 
            title: 'Quantum Computing Research', 
            url: 'about:blank', 
            timestamp: Date.now() - 3600000 
          },
          { 
            type: 'Trade', 
            title: 'Market Analysis', 
            url: 'about:blank', 
            timestamp: Date.now() - 7200000 
          },
        ]);
      }
    };

    // Delay initial load to allow IPC to initialize
    setTimeout(() => {
      loadData();
    }, 400);

    // Listen for workspace updates
    const unsubscribeWorkspace = ipcEvents.on('workspace:updated', () => {
      loadData();
    });

    return () => {
      unsubscribeWorkspace();
    };
  }, []);

  const quickActions = [
    { 
      icon: Sparkles, 
      label: 'Ask Agent', 
      action: async () => {
        navigate('/agent');
      }, 
    color: 'from-blue-500 to-cyan-500',
    description: 'Open the agent console to start a guided workflow.'
    },
    { 
      icon: Search, 
      label: 'Search Topic', 
      action: async () => {
        // Switch to research mode and open search
        setMode('Research');
        await ipc.tabs.create('about:blank');
      }, 
    color: 'from-purple-500 to-pink-500',
    description: 'Launch AI-powered research with citations-first results.'
    },
    { 
      icon: FileText, 
      label: 'Research Notes', 
      action: async () => {
        setMode('Research');
        await ipc.tabs.create('about:blank');
      }, 
    color: 'from-green-500 to-emerald-500',
    description: 'Capture structured notes that sync with your highlights.'
    },
    { 
      icon: Workflow, 
      label: 'Run Playbook', 
      action: () => {
        navigate('/playbooks');
      }, 
    color: 'from-orange-500 to-red-500',
    description: 'Automate multi-step workflows with reusable recipes.'
    },
  ];

  const handleContinueSession = async (session: any) => {
    try {
      let urlToLoad = session.url || 'about:blank';
      
      // Switch to the session first if it has a sessionId
      if (session.sessionId) {
        try {
          await ipc.sessions.setActive({ sessionId: session.sessionId });
          
          // Wait a bit for session to switch
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Check if session has tabs already
          const tabs = await ipc.tabs.list();
          if (tabs.length > 0) {
            // Session has tabs, they should be visible now
            // Activate the first tab if none is active
            const activeTab = tabs.find(t => t.active);
            if (!activeTab && tabs[0]) {
              await ipc.tabs.activate({ id: tabs[0].id });
            }
            return; // Tabs exist, don't create new one
          }
          
          // No tabs in session, create one with the session URL or default
          if (!urlToLoad || urlToLoad === 'about:blank') {
            // Try to get last visited URL from session or use default
            urlToLoad = 'about:blank';
          }
        } catch (error) {
          console.warn('Failed to set active session:', error);
          // Continue with creating a tab
        }
      }
      
      // Set mode if specified
      if (session.type === 'Research') {
        setMode('Research');
      } else if (session.type === 'Trade') {
        setMode('Trade');
      }
      
      // Create tab with the URL
      const result = await ipc.tabs.create(urlToLoad);
      if (!result) {
        throw new Error('Failed to create tab');
      }
      
      // Wait a bit for tab to be created and activated
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('Failed to continue session:', error);
      // Last resort: create a blank tab
      try {
        await ipc.tabs.create('about:blank');
      } catch (e) {
        console.error('Failed to create fallback tab:', e);
      }
    }
  };

  const activeTab = tabs.find((tab) => tab.id === activeId);
  const shouldShowDashboard =
    tabs.length === 0 ||
    !activeTab ||
    !activeTab.url ||
    activeTab.url === 'about:blank' ||
    activeTab.url.startsWith('ob://newtab') ||
    activeTab.url.startsWith('ob://home');

  if (!shouldShowDashboard) return null;

  return (
    <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-[#1A1D28] via-[#1F2332] to-[#1A1D28] flex items-center justify-center p-8 overflow-auto z-10">
      <div className="max-w-5xl w-full space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 space-y-3 text-left"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
            Command Center
          </p>
          <h1 className="text-4xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            OmniBrowser
          </h1>
          <p className="max-w-2xl text-sm text-gray-400">
            Launch an agentic workspace, resume a saved session, or jump straight into a trusted playbook.
          </p>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                onClick={action.action}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="group flex h-full flex-col items-start gap-3 rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-5 text-left transition-all hover:border-gray-600 hover:bg-gray-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${action.color} text-white shadow-lg shadow-black/20`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-gray-100 group-hover:text-white transition-colors">
                    {action.label}
                  </div>
                  {action.description ? (
                    <p className="text-xs leading-snug text-gray-500 group-hover:text-gray-300 transition-colors">
                      {action.description}
                    </p>
                  ) : null}
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
                  className="p-4 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-all text-left group cursor-pointer"
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
                  className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-all cursor-pointer"
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
