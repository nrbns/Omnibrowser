/**
 * Launch Readiness Dashboard (Day 7)
 * Visual dashboard showing launch readiness status
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import {
  runLaunchChecks,
  type LaunchCheckResult,
  type ChecklistItem,
} from '../utils/launchChecklist';
import { Skeleton } from '../ui/skeleton';

const STATUS_ICONS = {
  pass: CheckCircle2,
  fail: XCircle,
  warning: AlertTriangle,
  skip: Clock,
};

const STATUS_COLORS = {
  pass: 'text-emerald-400',
  fail: 'text-rose-400',
  warning: 'text-amber-400',
  skip: 'text-slate-400',
};

const CATEGORY_COLORS = {
  critical: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  important: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'nice-to-have': 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

export function LaunchReadiness({ className }: { className?: string }) {
  const [result, setResult] = useState<LaunchCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['critical']));
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runChecks = async () => {
    setLoading(true);
    try {
      const checks = await runLaunchChecks();
      setResult(checks);
      setLastChecked(new Date());
    } catch (error) {
      console.error('[LaunchReadiness] Failed to run checks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runChecks();
    // Re-run checks every 30 seconds
    const interval = setInterval(runChecks, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (loading && !result) {
    return (
      <div className={`space-y-4 ${className || ''}`}>
        <Skeleton variant="rectangular" height={200} />
        <Skeleton variant="rectangular" height={300} />
      </div>
    );
  }

  if (!result) return null;

  const groupedItems = result.items.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  const progressPercent = Math.round((result.passedItems / result.totalItems) * 100);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Launch Readiness</h2>
            <p className="text-sm text-slate-400">
              {result.ready ? (
                <span className="text-emerald-400">✅ Ready for launch</span>
              ) : (
                <span className="text-rose-400">
                  ⚠️ {result.criticalIssues} critical issue{result.criticalIssues !== 1 ? 's' : ''}{' '}
                  found
                </span>
              )}
            </p>
          </div>
          <button
            onClick={runChecks}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>
              {result.passedItems} / {result.totalItems} checks passed
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full ${
                result.ready
                  ? 'bg-emerald-500'
                  : result.criticalIssues > 0
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
              }`}
            />
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
            <div className="text-2xl font-bold text-rose-300">{result.criticalIssues}</div>
            <div className="text-xs text-rose-400">Critical</div>
          </div>
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3">
            <div className="text-2xl font-bold text-blue-300">{result.importantIssues}</div>
            <div className="text-xs text-blue-400">Important</div>
          </div>
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
            <div className="text-2xl font-bold text-emerald-300">{result.passedItems}</div>
            <div className="text-xs text-emerald-400">Passed</div>
          </div>
        </div>

        {lastChecked && (
          <div className="mt-4 text-xs text-slate-500">
            Last checked: {lastChecked.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Checklist items by category */}
      <div className="space-y-3">
        {(['critical', 'important', 'nice-to-have'] as const).map(category => {
          const items = groupedItems[category] || [];
          if (items.length === 0) return null;

          const isExpanded = expandedCategories.has(category);
          const failedCount = items.filter(i => i.status === 'fail').length;

          return (
            <div
              key={category}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden"
            >
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold border ${CATEGORY_COLORS[category]}`}
                  >
                    {category.toUpperCase()}
                  </span>
                  <span className="text-sm text-slate-300">
                    {items.length} check{items.length !== 1 ? 's' : ''}
                    {failedCount > 0 && (
                      <span className="ml-2 text-rose-400">({failedCount} failed)</span>
                    )}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp size={18} className="text-slate-400" />
                ) : (
                  <ChevronDown size={18} className="text-slate-400" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 space-y-2">
                      {items.map(item => {
                        const Icon = STATUS_ICONS[item.status];
                        const colorClass = STATUS_COLORS[item.status];

                        return (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50"
                          >
                            <Icon size={18} className={`mt-0.5 flex-shrink-0 ${colorClass}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-200">{item.label}</div>
                              {item.message && (
                                <div className="text-xs text-slate-400 mt-1">{item.message}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
