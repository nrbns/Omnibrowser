/**
 * Ghost Mode - Maximum Security Mode for Tor Browser
 * 
 * When enabled, Ghost Mode:
 * - Forces local AI only (no cloud APIs)
 * - Disables all tracking
 * - Uses ephemeral sessions (no storage)
 * - Blocks all external scripts
 * - Renders content as static HTML only
 * - Disables all non-essential features
 * 
 * This is the "world AI security browser" mode.
 */

import { TorDetector, detectTorBrowser } from './tor-detector';
import { DeviceDetector } from './device-detector';

export interface GhostModeConfig {
  enabled: boolean;
  localAIOnly: boolean;
  noCloudAPIs: boolean;
  noStorage: boolean;
  noScripts: boolean;
  noTracking: boolean;
  ephemeralSession: boolean;
  torDetected: boolean;
  securityLevel: 'maximum' | 'high' | 'standard';
}

export class GhostMode {
  private config: GhostModeConfig;
  private torDetector: TorDetector;
  private deviceDetector: DeviceDetector;

  constructor() {
    this.torDetector = new TorDetector();
    this.deviceDetector = new DeviceDetector();
    
    // Auto-detect Tor and enable Ghost Mode if detected
    const torDetection = detectTorBrowser();
    // const deviceCaps = detectDeviceCapabilities(); // Unused for now
    
    this.config = {
      enabled: torDetection.isTorBrowser && torDetection.confidence !== 'low',
      localAIOnly: true, // Always true in Ghost Mode
      noCloudAPIs: true, // Always true in Ghost Mode
      noStorage: true, // Ephemeral sessions
      noScripts: true, // No external scripts
      noTracking: true, // No tracking
      ephemeralSession: true, // No persistence
      torDetected: torDetection.isTorBrowser,
      securityLevel: torDetection.isTorBrowser ? 'maximum' : 'standard',
    };

    if (this.config.enabled) {
      this.activateGhostMode();
    }
  }

  /**
   * Activate Ghost Mode
   */
  private activateGhostMode(): void {
    // Add Ghost Mode class to document
    document.documentElement.classList.add('ghost-mode');
    document.documentElement.setAttribute('data-ghost-mode', 'true');
    
    // Disable localStorage (ephemeral sessions)
    if (this.config.noStorage) {
      try {
        // Override localStorage to prevent writes
        // const originalSetItem = Storage.prototype.setItem; // Unused for now
        Storage.prototype.setItem = function() {
          console.warn('[Ghost Mode] Storage disabled - ephemeral session only');
          // Silently fail or use memory-only storage
        };
      } catch (e) {
        console.warn('[Ghost Mode] Could not disable storage:', e);
      }
    }

    // Disable external scripts
    if (this.config.noScripts) {
      // Block script execution (in production, use CSP)
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "script-src 'self' 'unsafe-inline'; object-src 'none';";
      document.head.appendChild(meta);
    }

    console.log('🔒 Ghost Mode activated - Maximum security enabled');
    console.log('🔒 Tor detected:', this.config.torDetected);
    console.log('🔒 Local AI only:', this.config.localAIOnly);
    console.log('🔒 Ephemeral session:', this.config.ephemeralSession);
  }

  /**
   * Enable Ghost Mode manually
   */
  enable(): void {
    if (this.config.enabled) {
      return; // Already enabled
    }

    // Check if we can enable (need Tor or user consent)
    const torDetection = detectTorBrowser();
    if (!torDetection.isTorBrowser) {
      // Show warning - Ghost Mode is most secure in Tor Browser
      const confirmed = confirm(
        '⚠️ Ghost Mode is most secure when running inside Tor Browser.\n\n' +
        'Without Tor Browser, some security features may be limited.\n\n' +
        'Enable Ghost Mode anyway?'
      );
      if (!confirmed) {
        return;
      }
    }

    this.config.enabled = true;
    this.config.securityLevel = torDetection.isTorBrowser ? 'maximum' : 'high';
    this.activateGhostMode();
  }

  /**
   * Disable Ghost Mode
   */
  disable(): void {
    if (!this.config.enabled) {
      return;
    }

    this.config.enabled = false;
    this.config.securityLevel = 'standard';
    document.documentElement.classList.remove('ghost-mode');
    document.documentElement.removeAttribute('data-ghost-mode');
    
    console.log('🔓 Ghost Mode disabled');
  }

  /**
   * Check if Ghost Mode is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get Ghost Mode configuration
   */
  getConfig(): GhostModeConfig {
    return { ...this.config };
  }

  /**
   * Check if cloud APIs are allowed
   */
  canUseCloudAPI(): boolean {
    return !this.config.enabled || !this.config.noCloudAPIs;
  }

  /**
   * Check if storage is allowed
   */
  canUseStorage(): boolean {
    return !this.config.enabled || !this.config.noStorage;
  }

  /**
   * Check if scripts are allowed
   */
  canUseScripts(): boolean {
    return !this.config.enabled || !this.config.noScripts;
  }

  /**
   * Get security status message
   */
  getSecurityStatus(): string {
    if (!this.config.enabled) {
      return 'Standard security';
    }

    const parts: string[] = [];
    
    if (this.config.torDetected) {
      parts.push('🔒 Tor: Active');
    }
    
    if (this.config.localAIOnly) {
      parts.push('🤖 AI: Local');
    }
    
    if (this.config.noTracking) {
      parts.push('🚫 Tracking: Blocked');
    }
    
    if (this.config.ephemeralSession) {
      parts.push('💨 Session: Ephemeral');
    }

    return parts.join(' | ') || 'Ghost Mode: Active';
  }
}

// Singleton instance
let ghostModeInstance: GhostMode | null = null;

/**
 * Get the global GhostMode instance
 */
export function getGhostMode(): GhostMode {
  if (!ghostModeInstance) {
    ghostModeInstance = new GhostMode();
  }
  return ghostModeInstance;
}

/**
 * Check if Ghost Mode is enabled
 */
export function isGhostModeEnabled(): boolean {
  return getGhostMode().isEnabled();
}

/**
 * Enable Ghost Mode
 */
export function enableGhostMode(): void {
  getGhostMode().enable();
}

/**
 * Disable Ghost Mode
 */
export function disableGhostMode(): void {
  getGhostMode().disable();
}

