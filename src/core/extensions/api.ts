/**
 * Extensions API
 * Provides window.regenExtensions for Chrome-compatible extension registration
 * Preload hook for Chrome compatibility
 */

import { log } from '../../utils/logger';
import { pluginRegistry, type OmniPlugin } from '../plugins/registry';

export interface RegenExtension {
  id: string;
  name?: string;
  version?: string;
  activate?: () => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
  provide?: Record<string, unknown>;
}

class ExtensionsAPI {
  private extensions: Map<string, RegenExtension> = new Map();

  /**
   * Register an extension
   */
  register(extension: RegenExtension): void {
    if (this.extensions.has(extension.id)) {
      log.warn(`[ExtensionsAPI] Extension ${extension.id} already registered`);
      return;
    }

    this.extensions.set(extension.id, extension);

    // Convert to plugin format and register with plugin registry
    const plugin: OmniPlugin = {
      id: extension.id,
      name: extension.name || extension.id,
      version: extension.version || '1.0.0',
      description: `Extension: ${extension.name || extension.id}`,
      enabled: true,
      onEnable: extension.activate,
      onDisable: extension.deactivate,
    };

    pluginRegistry.register(plugin);

    log.info(`[ExtensionsAPI] Registered extension: ${extension.id}`);
  }

  /**
   * List all registered extensions
   */
  list(): Array<{ id: string; name?: string; version?: string }> {
    return Array.from(this.extensions.values()).map(ext => ({
      id: ext.id,
      name: ext.name,
      version: ext.version,
    }));
  }

  /**
   * Get extension by ID
   */
  get(id: string): RegenExtension | undefined {
    return this.extensions.get(id);
  }

  /**
   * Activate an extension
   */
  async activate(id: string): Promise<boolean> {
    const extension = this.extensions.get(id);
    if (!extension) {
      return false;
    }

    if (extension.activate) {
      try {
        await extension.activate();
        log.info(`[ExtensionsAPI] Activated extension: ${id}`);
        return true;
      } catch (error) {
        log.error(`[ExtensionsAPI] Failed to activate extension ${id}:`, error);
        return false;
      }
    }

    return true;
  }

  /**
   * Deactivate an extension
   */
  async deactivate(id: string): Promise<boolean> {
    const extension = this.extensions.get(id);
    if (!extension) {
      return false;
    }

    if (extension.deactivate) {
      try {
        await extension.deactivate();
        log.info(`[ExtensionsAPI] Deactivated extension: ${id}`);
        return true;
      } catch (error) {
        log.error(`[ExtensionsAPI] Failed to deactivate extension ${id}:`, error);
        return false;
      }
    }

    return true;
  }
}

// Singleton instance
const extensionsAPI = new ExtensionsAPI();

/**
 * Initialize Extensions API on window object
 * Provides Chrome-compatible extension registration
 */
export function initExtensionsAPI(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Initialize window.regenExtensions if not already present
  if (!window.regenExtensions) {
    window.regenExtensions = {
      register: (extension: RegenExtension) => {
        extensionsAPI.register(extension);
      },
      list: () => {
        return extensionsAPI.list();
      },
    };
  }

  // Preload hook for Chrome compatibility
  // This allows extensions to register before the app fully loads
  if (typeof (window as any).__regenExtensionsPreload === 'function') {
    try {
      (window as any).__regenExtensionsPreload(window.regenExtensions);
    } catch (error) {
      log.warn('[ExtensionsAPI] Preload hook failed:', error);
    }
  }

  log.info('[ExtensionsAPI] Initialized window.regenExtensions');
}

/**
 * Preload hook for Chrome compatibility
 * Allows extensions to register early
 */
export function setupPreloadHook(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Create preload function that extensions can call
  (window as any).__regenExtensionsPreload = (_api: typeof window.regenExtensions) => {
    log.info('[ExtensionsAPI] Preload hook called');
    // Extensions can use this to register before app initialization
  };
}
