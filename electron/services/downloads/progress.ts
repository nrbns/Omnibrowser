/**
 * Progress Tracking - Real-time progress updates
 */

import { EventEmitter } from 'node:events';
export interface ProgressUpdate {
  downloadId: string;
  progress: number;
  speed?: string;
  eta?: number; // Estimated seconds remaining
  bytesDownloaded?: number;
  bytesTotal?: number;
}

export class ProgressTracker extends EventEmitter {
  private updates: Map<string, ProgressUpdate> = new Map();

  /**
   * Update progress for a download
   */
  update(downloadId: string, update: Partial<ProgressUpdate>): void {
    const existing = this.updates.get(downloadId) || {
      downloadId,
      progress: 0,
    };

    const updated: ProgressUpdate = {
      ...existing,
      ...update,
    };

    this.updates.set(downloadId, updated);
    this.emit('update', updated);
  }

  /**
   * Get progress for a download
   */
  getProgress(downloadId: string): ProgressUpdate | undefined {
    return this.updates.get(downloadId);
  }

  /**
   * Clear progress for a download
   */
  clear(downloadId: string): void {
    this.updates.delete(downloadId);
  }

  /**
   * Calculate ETA based on speed and remaining
   */
  calculateETA(progress: number, speed?: string): number | undefined {
    if (!speed || progress >= 100) return undefined;

    // Parse speed (e.g., "1.5MiB/s")
    const speedMatch = speed.match(/([\d.]+)([KMGT]?i?B)\/s/);
    if (!speedMatch) return undefined;

    const value = parseFloat(speedMatch[1]);
    const unit = speedMatch[2].toLowerCase();
    const multiplier: Record<string, number> = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024,
    };
    const bytesPerSecond = value * (multiplier[unit] || 1);

    const remaining = 100 - progress;
    const remainingPercent = remaining / 100;

    // Estimate total size (rough)
    // This is approximate - would need actual file size
    const estimatedTotal = 100000000; // 100MB default estimate
    const remainingBytes = estimatedTotal * remainingPercent;
    const etaSeconds = remainingBytes / bytesPerSecond;

    return Math.ceil(etaSeconds);
  }
}

// Singleton instance
let trackerInstance: ProgressTracker | null = null;

export function getProgressTracker(): ProgressTracker {
  if (!trackerInstance) {
    trackerInstance = new ProgressTracker();
  }
  return trackerInstance;
}

