import { useEffect, useState } from 'react';
import { useAppStore } from '../state/appStore';
import { ipcEvents } from '../lib/ipc-events';
import TradePanel from '../modes/trade';
import GamesPanel from '../modes/games';
import DocsPanel from '../modes/docs';
import ImagesPanel from '../modes/images';
import ThreatsPanel from '../modes/threats';
import GraphMindPanel from '../modes/graphmind';
import ResearchPanel from '../modes/research';
import { MainView } from '../components/layout/MainView';
import { ResearchSplit } from '../components/Panels/ResearchSplit';
import { OmniDesk } from '../components/OmniDesk';
import { ResearchPane } from '../components/research/ResearchPane';

export default function Home() {
  const mode = useAppStore(s=>s.mode);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize fullscreen state on mount - ensure it starts as false
  useEffect(() => {
    // Force initial state to false (window should not start in fullscreen)
    setIsFullscreen(false);
    
    // Check initial fullscreen state after a brief delay
    const checkFullscreen = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || (window as any).webkitFullscreenElement || (window as any).mozFullScreenElement);
      if (isCurrentlyFullscreen !== isFullscreen) {
        setIsFullscreen(isCurrentlyFullscreen);
      }
    };
    
    // Check after a brief delay to ensure window is ready
    const timeoutId = setTimeout(checkFullscreen, 100);
    
    // Listen for fullscreen changes from Electron
    const handleFullscreen = (data: { fullscreen: boolean }) => {
      setIsFullscreen(data.fullscreen);
    };
    
    // Use the IPC event bus
    const unsubscribe = ipcEvents.on<{ fullscreen: boolean }>('app:fullscreen-changed', handleFullscreen);
    
    // Also listen for browser fullscreen changes
    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);
    document.addEventListener('mozfullscreenchange', checkFullscreen);
    
    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
      document.removeEventListener('mozfullscreenchange', checkFullscreen);
    };
  }, []);
  
  return (
    <div className={`h-full w-full bg-[#1A1D28] flex flex-col overflow-hidden ${isFullscreen ? 'absolute inset-0' : ''}`}>
      {mode === 'Browse' || !mode ? (
        <div className="flex-1 w-full relative min-h-0 overflow-hidden">
          <MainView />
          {/* Show OmniDesk when no tabs or active tab is about:blank (search page) */}
          {/* OmniDesk will handle its own visibility logic */}
          {/* z-20 is below TabStrip (z-50) to ensure tabs are always clickable */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="pointer-events-auto h-full w-full">
              <OmniDesk variant="overlay" />
            </div>
          </div>
        </div>
      ) : mode === 'Research' ? (
        <div className="flex-1 w-full relative flex flex-col min-h-0 overflow-hidden">
          {/* Top: Research Panel (full width) */}
          {!isFullscreen && (
            <div className="h-96 border-b border-gray-700/30 flex-shrink-0 overflow-hidden">
              <ResearchPanel />
            </div>
          )}
          {/* Bottom: Browser view with ResearchSplit overlay */}
          <div className="flex-1 relative min-h-0 overflow-hidden">
            <MainView />
            {/* Show ResearchSplit overlay when not fullscreen */}
            {!isFullscreen && (
              <div className="absolute inset-0 pointer-events-none z-30">
                <div className="pointer-events-auto h-full w-full">
                  <ResearchSplit />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : mode === 'Trade' ? (
        <TradePanel />
      ) : mode === 'Games' ? (
        <GamesPanel />
      ) : mode === 'Docs' ? (
        <DocsPanel />
      ) : mode === 'Images' ? (
        <ImagesPanel />
      ) : mode === 'Threats' ? (
        <ThreatsPanel />
      ) : mode === 'GraphMind' ? (
        <GraphMindPanel />
      ) : null}
      
      {/* Research Pane - Available in all modes except Research (which has its own panel) */}
      {!isFullscreen && mode !== 'Research' && <ResearchPane />}
    </div>
  );
}


