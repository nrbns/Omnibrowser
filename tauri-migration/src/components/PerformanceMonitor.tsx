/**
 * Performance Monitor Dashboard (Day 7)
 * Real-time performance metrics and monitoring
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Gauge, Cpu, HardDrive, Zap, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { isDevEnv } from '../lib/env';

interface PerformanceMetrics {
  loadTime: number;
  memoryUsage: number;
  memoryLimit?: number;
  fps: number;
  renderTime: number;
  networkRequests: number;
  cacheHitRate: number;
}

export function PerformanceMonitor({ className }: { className?: string }) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    memoryUsage: 0,
    fps: 60,
    renderTime: 0,
    networkRequests: 0,
    cacheHitRate: 0,
  });
  const [isVisible, setIsVisible] = useState(false);
  const frameRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);

  // Only show in dev mode or when explicitly enabled
  useEffect(() => {
    const shouldShow = isDevEnv() || localStorage.getItem('regen:perf-monitor') === 'true';
    setIsVisible(shouldShow);
  }, []);

  useEffect(() => {
    // Measure initial load time
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (perfData) {
      const loadTime = perfData.loadEventEnd - perfData.fetchStart;
      setMetrics(prev => ({ ...prev, loadTime }));
    }

    // Measure memory usage
    const updateMemory = () => {
      const memory = (performance as any).memory;
      if (memory) {
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize,
          memoryLimit: memory.jsHeapSizeLimit,
        }));
      }
    };

    // FPS monitoring
    const measureFPS = () => {
      const now = performance.now();
      const delta = now - lastFrameTimeRef.current;
      frameCountRef.current++;

      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        setMetrics(prev => ({ ...prev, fps }));
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }

      frameRef.current = requestAnimationFrame(measureFPS);
    };

    frameRef.current = requestAnimationFrame(measureFPS);

    // Memory monitoring interval
    const memoryInterval = setInterval(updateMemory, 1000);
    updateMemory();

    // Network request monitoring
    const observer = new PerformanceObserver(list => {
      const entries = list.getEntries();
      const requests = entries.filter(e => e.entryType === 'resource').length;
      setMetrics(prev => ({ ...prev, networkRequests: requests }));
    });

    try {
      observer.observe({ entryTypes: ['resource'] });
    } catch {
      // PerformanceObserver may not be supported
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      clearInterval(memoryInterval);
      observer.disconnect();
    };
  }, []);

  if (!isVisible) return null;

  const memoryMB = metrics.memoryUsage / 1024 / 1024;
  const memoryLimitMB = metrics.memoryLimit ? metrics.memoryLimit / 1024 / 1024 : 0;
  const memoryPercent = metrics.memoryLimit
    ? Math.round((metrics.memoryUsage / metrics.memoryLimit) * 100)
    : 0;

  const getMetricColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-emerald-400';
    if (value <= thresholds.warning) return 'text-amber-400';
    return 'text-rose-400';
  };

  const fpsColor = getMetricColor(metrics.fps, { good: 55, warning: 30 });
  const memoryColor = getMetricColor(memoryMB, { good: 80, warning: 100 });
  const loadTimeColor = getMetricColor(metrics.loadTime, { good: 2500, warning: 5000 });

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed bottom-4 right-4 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl z-50 ${className || ''}`}
    >
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-blue-400" />
            <h3 className="font-semibold text-white text-sm">Performance Monitor</h3>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-800"
          >
            ×
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Load Time */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Zap size={14} />
              <span>Cold Start</span>
            </div>
            <span className={`font-mono font-semibold ${loadTimeColor}`}>
              {Math.round(metrics.loadTime)}ms
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${loadTimeColor.replace('text-', 'bg-')}`}
              style={{ width: `${Math.min(100, (metrics.loadTime / 5000) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">Target: &lt; 2500ms</div>
        </div>

        {/* Memory Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <HardDrive size={14} />
              <span>Memory</span>
            </div>
            <span className={`font-mono font-semibold ${memoryColor}`}>
              {memoryMB.toFixed(1)} MB
              {memoryLimitMB > 0 && ` / ${memoryLimitMB.toFixed(0)} MB`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${memoryColor.replace('text-', 'bg-')}`}
              style={{ width: `${memoryPercent}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">Target: &lt; 110 MB</div>
        </div>

        {/* FPS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Gauge size={14} />
              <span>FPS</span>
            </div>
            <span className={`font-mono font-semibold ${fpsColor}`}>{metrics.fps}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${fpsColor.replace('text-', 'bg-')}`}
              style={{ width: `${(metrics.fps / 60) * 100}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">Target: 60 FPS</div>
        </div>

        {/* Network Requests */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu size={14} />
            <span>Network Requests</span>
          </div>
          <span className="font-mono font-semibold text-slate-300">{metrics.networkRequests}</span>
        </div>

        {/* Status Badge */}
        <div className="pt-2 border-t border-slate-700">
          <div
            className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium ${
              metrics.loadTime < 2500 && memoryMB < 110 && metrics.fps >= 55
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}
          >
            {metrics.loadTime < 2500 && memoryMB < 110 && metrics.fps >= 55 ? (
              <>
                <TrendingUp size={12} />
                Optimal
              </>
            ) : (
              <>
                <TrendingDown size={12} />
                Needs Optimization
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
