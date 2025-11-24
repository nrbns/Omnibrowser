import { useMemo } from 'react';

export function useLazyAgentEngine() {
  return useMemo(
    () => ({
      async runTask<T>(request: T) {
        const { aiEngine } = await import('../core/ai');
        return aiEngine.runTask(request as any);
      },
    }),
    []
  );
}
