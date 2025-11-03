/**
 * Feature Flags Service
 * Supports Unleash and ConfigCat providers
 */

export type FeatureFlagProvider = 'unleash' | 'configcat' | 'local';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  value?: unknown;
  variant?: string;
}

export interface FeatureFlagsConfig {
  provider: FeatureFlagProvider;
  apiKey?: string;
  endpoint?: string;
  appName?: string;
  environment?: string;
  refreshInterval?: number; // milliseconds
}

class FeatureFlagsService {
  private config: FeatureFlagsConfig = {
    provider: 'local',
    refreshInterval: 60000, // 1 minute
  };

  private flags: Map<string, FeatureFlag> = new Map();
  private refreshTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize feature flags service
   */
  async initialize(config: Partial<FeatureFlagsConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    // Load initial flags
    await this.refreshFlags();

    // Set up periodic refresh
    if (this.config.refreshInterval && this.config.refreshInterval > 0) {
      this.refreshTimer = setInterval(
        () => this.refreshFlags(),
        this.config.refreshInterval
      );
    }
  }

  /**
   * Refresh flags from provider
   */
  private async refreshFlags(): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'unleash':
          await this.refreshFromUnleash();
          break;
        case 'configcat':
          await this.refreshFromConfigCat();
          break;
        case 'local':
          await this.refreshFromLocal();
          break;
      }
    } catch (error) {
      console.error('[FeatureFlags] Failed to refresh flags:', error);
    }
  }

  /**
   * Refresh from Unleash
   */
  private async refreshFromUnleash(): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      throw new Error('Unleash endpoint and API key required');
    }

    const response = await fetch(`${this.config.endpoint}/api/client/features`, {
      headers: {
        'Authorization': this.config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Unleash API error: ${response.status}`);
    }

    const data = await response.json() as { features: Array<{ name: string; enabled: boolean; variants?: Array<{ name: string; enabled: boolean }> }> };
    
    for (const feature of data.features) {
      const variant = feature.variants?.find(v => v.enabled);
      this.flags.set(feature.name, {
        name: feature.name,
        enabled: feature.enabled,
        variant: variant?.name,
      });
    }
  }

  /**
   * Refresh from ConfigCat
   */
  private async refreshFromConfigCat(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('ConfigCat API key required');
    }

    // ConfigCat SDK would be used here
    // For now, placeholder implementation
    console.log('[FeatureFlags] ConfigCat integration placeholder');
  }

  /**
   * Refresh from local config
   */
  private async refreshFromLocal(): Promise<void> {
    // Load from local file or environment variables
    try {
      const fs = require('fs/promises');
      const path = require('path');
      const { app } = require('electron');
      
      const configPath = path.join(
        app.getPath('userData'),
        'feature-flags.json'
      );

      try {
        const data = await fs.readFile(configPath, 'utf-8');
        const localFlags = JSON.parse(data) as Record<string, boolean>;
        
        for (const [name, enabled] of Object.entries(localFlags)) {
          this.flags.set(name, {
            name,
            enabled,
          });
        }
      } catch {
        // File doesn't exist, use defaults
        this.setDefaultFlags();
      }
    } catch {
      this.setDefaultFlags();
    }
  }

  /**
   * Set default flags
   */
  private setDefaultFlags(): void {
    // Default feature flags
    const defaults: Record<string, boolean> = {
      'pdf-viewer': true,
      'yt-dlp-downloads': true,
      'ai-summarization': true,
      'advanced-search': true,
      'workspace-v2': true,
      'agent-console': true,
      'dark-mode': true,
    };

    for (const [name, enabled] of Object.entries(defaults)) {
      this.flags.set(name, { name, enabled });
    }
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(flagName: string, defaultValue: boolean = false): boolean {
    const flag = this.flags.get(flagName);
    return flag?.enabled ?? defaultValue;
  }

  /**
   * Get feature flag value
   */
  getFlag(flagName: string): FeatureFlag | null {
    return this.flags.get(flagName) || null;
  }

  /**
   * Get all flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Set local flag (for testing/overrides)
   */
  setFlag(name: string, enabled: boolean): void {
    this.flags.set(name, { name, enabled });
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// Singleton instance
let flagsInstance: FeatureFlagsService | null = null;

export function getFeatureFlagsService(): FeatureFlagsService {
  if (!flagsInstance) {
    flagsInstance = new FeatureFlagsService();
  }
  return flagsInstance;
}

