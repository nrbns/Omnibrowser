const EXTENSION_REGISTRY_KEY = '__regen_extension_registry__';

type RegisteredExtension = {
  id: string;
  name?: string;
  version?: string;
  activate?: () => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
  provide?: Record<string, unknown>;
};

const extensionRegistry: RegisteredExtension[] = [];

function ensureBridge() {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.regenExtensions) {
    return;
  }

  window.regenExtensions = {
    register(extension: RegisteredExtension) {
      if (!extension || !extension.id) {
        console.warn('[Extensions] register() requires an id');
        return;
      }
      const existingIndex = extensionRegistry.findIndex((entry) => entry.id === extension.id);
      if (existingIndex >= 0) {
        extensionRegistry.splice(existingIndex, 1);
      }
      extensionRegistry.push(extension);
      if (typeof extension.activate === 'function') {
        try {
          void extension.activate();
        } catch (error) {
          console.error('[Extensions] activate() failed', error);
        }
      }
      (window as any)[EXTENSION_REGISTRY_KEY] = extensionRegistry;
    },
    list() {
      return [...extensionRegistry];
    },
  };
}

ensureBridge();

