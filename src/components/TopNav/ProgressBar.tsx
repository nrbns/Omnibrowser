/**
 * ProgressBar - Animated loading indicator under omnibox
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIPCEvent } from '../../lib/use-ipc-event';

export function ProgressBar() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Listen for tab loading state
  useIPCEvent('tabs:loading-start', () => {
    setIsLoading(true);
    setProgress(0);
  }, []);

  useIPCEvent('tabs:loading-progress', (data: { progress: number }) => {
    setProgress(data.progress || 0);
  }, []);

  useIPCEvent('tabs:loading-complete', () => {
    setIsLoading(true);
    setProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 300);
  }, []);

  // Simulate progress when loading
  useEffect(() => {
    if (isLoading && progress < 90) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isLoading, progress]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleX: 0 }}
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 origin-left"
          style={{ scaleX: progress / 100 }}
        />
      )}
    </AnimatePresence>
  );
}

