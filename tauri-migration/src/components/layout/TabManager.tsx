import { useEffect } from 'react';
import { isElectronRuntime } from '../../lib/env';

export function TabManager() {
  useEffect(() => {
    if (!isElectronRuntime()) {
      return;
    }
    let cancelled = false;
    let moduleRef: Promise<typeof import('../../core/redix/tab-suspension')> | null = null;
    const timer = window.setTimeout(() => {
      moduleRef = import('../../core/redix/tab-suspension');
      moduleRef
        .then(mod => {
          if (!cancelled) {
            mod.startTabSuspensionService?.();
          } else {
            mod.stopTabSuspensionService?.();
          }
        })
        .catch(() => {});
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      moduleRef
        ?.then(mod => mod.stopTabSuspensionService?.())
        .catch(() => {});
    };
  }, []);

  return null;
}
