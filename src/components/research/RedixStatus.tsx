import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BatteryCharging, Leaf, Sparkles } from 'lucide-react';
import { useEfficiencyStore } from '../../state/efficiencyStore';

interface RedixStatusProps {
  loading: boolean;
  hasIssues: boolean;
  lastRunAt: number | null;
}

const shimmer =
  'bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]';

export function RedixStatus({ loading, hasIssues, lastRunAt }: RedixStatusProps) {
  const { mode, label, badge, snapshot } = useEfficiencyStore((state) => ({
    mode: state.mode,
    label: state.label,
    badge: state.badge,
    snapshot: state.snapshot,
  }));

  const greenScore = useMemo(() => {
    const base = mode === 'extreme' ? 94 : mode === 'battery-saver' ? 88 : 82;
    const cpuPenalty = Math.min(8, Math.max(0, snapshot.cpuLoad1 * 6));
    const tabsPenalty = Math.min(6, Math.max(0, (snapshot.activeTabs - 4) * 1.5));
    return Math.max(60, Math.round(base - cpuPenalty - tabsPenalty));
  }, [mode, snapshot.cpuLoad1, snapshot.activeTabs]);

  const projectedBattery = useMemo(() => {
    if (typeof snapshot.batteryPct !== 'number') return null;
    if (snapshot.batteryPct <= 0) return null;
    const normalized = snapshot.batteryPct / 100;
    const baselineHours = mode === 'extreme' ? 4 : mode === 'battery-saver' ? 3 : 2.2;
    const hours = baselineHours * normalized;
    return `${hours.toFixed(1)} hr`;
  }, [snapshot.batteryPct, mode]);

  const statusMessage = useMemo(() => {
    if (loading) {
      return 'Redix is synthesizing…';
    }
    if (hasIssues) {
      return 'Review suggested citations — verification flagged items to check.';
    }
    return 'All findings verified. Green score looks solid.';
  }, [loading, hasIssues]);

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 shadow-lg shadow-emerald-500/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
            <Sparkles className="h-4 w-4 text-emerald-200" />
          </span>
          <div>
            <p className="font-medium leading-tight">{statusMessage}</p>
            {lastRunAt && !loading && (
              <p className="text-xs text-emerald-200/80">
                Updated {new Date(lastRunAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <motion.span
            className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-medium ${loading ? shimmer : ''}`}
            animate={loading ? { opacity: [0.6, 1, 0.6] } : undefined}
            transition={loading ? { duration: 1.2, repeat: Infinity } : undefined}
          >
            <Leaf className="h-3.5 w-3.5 text-emerald-200" />
            Green Score&nbsp;
            <span className="font-semibold">{loading ? '···' : `${greenScore}%`}</span>
          </motion.span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-medium">
            <BatteryCharging className="h-3.5 w-3.5 text-emerald-200" />
            {label}
            {badge && <span className="text-emerald-100/80">{badge}</span>}
            {projectedBattery && (
              <span className="text-emerald-100/70">· ~{projectedBattery} remaining</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ResearchSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
        >
          <div className={`h-3 w-32 rounded-full bg-emerald-400/20 ${shimmer}`} />
          <div className="mt-3 space-y-2">
            <div className={`h-3 w-full rounded-full bg-emerald-400/10 ${shimmer}`} />
            <div className={`h-3 w-5/6 rounded-full bg-emerald-400/10 ${shimmer}`} />
            <div className={`h-3 w-2/3 rounded-full bg-emerald-400/10 ${shimmer}`} />
          </div>
        </div>
      ))}
    </div>
  );
}


