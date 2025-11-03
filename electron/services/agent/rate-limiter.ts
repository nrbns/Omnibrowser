/**
 * Rate Limiter - Dedicated service for throttling agent requests
 * Prevents abuse and ensures fair resource usage
 */

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay?: number;
  windowMs: number; // Sliding window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Timestamp when limit resets
  retryAfter?: number; // Seconds to wait before retry
}

class RateLimiter {
  private config: RateLimitConfig;
  private counters: Map<string, { 
    minute: number[]; 
    hour: number[]; 
    day: number[] 
  }> = new Map();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRequestsPerMinute: 30,
      maxRequestsPerHour: 1000,
      maxRequestsPerDay: 10000,
      windowMs: 60000, // 1 minute default
      ...config,
    };
  }

  /**
   * Check if a request is allowed
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    let counter = this.counters.get(identifier);
    
    if (!counter) {
      counter = { minute: [], hour: [], day: [] };
      this.counters.set(identifier, counter);
    }

    // Clean old entries
    counter.minute = counter.minute.filter(t => now - t < 60000);
    counter.hour = counter.hour.filter(t => now - t < 3600000);
    counter.day = counter.day.filter(t => now - t < 86400000);

    // Check minute limit
    if (counter.minute.length >= this.config.maxRequestsPerMinute) {
      const oldest = Math.min(...counter.minute);
      const retryAfter = Math.ceil((60000 - (now - oldest)) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldest + 60000,
        retryAfter,
      };
    }

    // Check hour limit
    if (counter.hour.length >= this.config.maxRequestsPerHour) {
      const oldest = Math.min(...counter.hour);
      const retryAfter = Math.ceil((3600000 - (now - oldest)) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldest + 3600000,
        retryAfter,
      };
    }

    // Check day limit
    if (this.config.maxRequestsPerDay && counter.day.length >= this.config.maxRequestsPerDay) {
      const oldest = Math.min(...counter.day);
      const retryAfter = Math.ceil((86400000 - (now - oldest)) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldest + 86400000,
        retryAfter,
      };
    }

    // Record request
    counter.minute.push(now);
    counter.hour.push(now);
    if (this.config.maxRequestsPerDay) {
      counter.day.push(now);
    }

    // Calculate remaining and reset time
    const nextMinuteReset = Math.max(...counter.minute) + 60000;
    const remaining = Math.max(
      this.config.maxRequestsPerMinute - counter.minute.length,
      this.config.maxRequestsPerHour - counter.hour.length,
      this.config.maxRequestsPerDay ? this.config.maxRequestsPerDay - counter.day.length : Infinity
    );

    return {
      allowed: true,
      remaining,
      resetAt: nextMinuteReset,
    };
  }

  /**
   * Reset limits for an identifier
   */
  reset(identifier: string): void {
    this.counters.delete(identifier);
  }

  /**
   * Get current status without incrementing
   */
  getStatus(identifier: string): RateLimitResult {
    const now = Date.now();
    const counter = this.counters.get(identifier);
    
    if (!counter) {
      return {
        allowed: true,
        remaining: this.config.maxRequestsPerMinute,
        resetAt: now + 60000,
      };
    }

    // Clean old entries
    counter.minute = counter.minute.filter(t => now - t < 60000);
    counter.hour = counter.hour.filter(t => now - t < 3600000);
    counter.day = counter.day.filter(t => now - t < 86400000);

    const remaining = Math.max(
      this.config.maxRequestsPerMinute - counter.minute.length,
      this.config.maxRequestsPerHour - counter.hour.length,
      this.config.maxRequestsPerDay ? this.config.maxRequestsPerDay - counter.day.length : Infinity
    );

    const nextReset = counter.minute.length > 0 
      ? Math.max(...counter.minute) + 60000
      : now + 60000;

    return {
      allowed: remaining > 0,
      remaining,
      resetAt: nextReset,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}

