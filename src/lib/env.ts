export const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process?.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  if (
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    (import.meta as any).env[key] !== undefined
  ) {
    return (import.meta as any).env[key];
  }
  return undefined;
};

export const isDevEnv = (): boolean => {
  const nodeMode = getEnvVar('NODE_ENV');
  if (nodeMode) {
    return nodeMode === 'development';
  }
  const viteMode = getEnvVar('MODE');
  return viteMode === 'development';
};

const hasWindowContext = () => typeof window !== 'undefined';

const detectTauriBridge = (): boolean => {
  if (!hasWindowContext()) {
    return false;
  }
  const w = window as any;
  return Boolean(w.__TAURI__ || w.__TAURI_IPC__ || w.__TAURI_METADATA__);
};

const detectElectronBridge = (): boolean => {
  if (!hasWindowContext()) {
    return false;
  }

  const maybeIpc = (window as any).ipc;
  if (maybeIpc && typeof maybeIpc.invoke === 'function') {
    return true;
  }

  if ((window as any).electron) {
    return true;
  }

  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent.includes('Electron');
  }

  return false;
};

export const isTauriRuntime = (): boolean => detectTauriBridge();

export const isDesktopRuntime = (): boolean => detectTauriBridge() || detectElectronBridge();

export const isElectronRuntime = (): boolean => isDesktopRuntime();
