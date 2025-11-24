import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'react-hot-toast';

type Warning = { value: number; timestamp: number };

export function MemoryWarningBanner() {
  const [warning, setWarning] = useState<Warning | null>(null);

  useEffect(() => {
    let active = true;
    const unsubPromise = listen<number>('system:memory-warning', event => {
      if (!active) return;
      const value = event.payload;
      setWarning({ value, timestamp: Date.now() });
      const mb = (value as number) / 1024;
      toast.error(`Memory high: ${mb.toFixed(0)} MB. Reloading…`, { id: 'memory-warning' });
    });
    return () => {
      active = false;
      unsubPromise.then(unsub => unsub()).catch(() => {});
    };
  }, []);

  if (!warning) {
    return null;
  }

  const age = Date.now() - warning.timestamp;
  if (age > 15000) {
    return null;
  }

  const mb = warning.value / 1024;
  return (
    <div className="fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 px-4">
      <div className="rounded-xl border border-amber-400/50 bg-amber-500/20 px-4 py-2 text-sm text-amber-100 shadow-lg shadow-black/40 backdrop-blur">
        <p className="font-medium">Low-memory mode activated</p>
        <p className="text-xs text-amber-100/80">Usage: {mb.toFixed(0)} MB • Tabs will refresh to stay under 130 MB.</p>
      </div>
    </div>
  );
}
