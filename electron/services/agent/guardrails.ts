/**
 * Guardrails - Safety checks for agent actions
 * Prompt firewall, domain allow/deny, rate limits, PII scrubbing
 */

import { PlanStep } from './planner';

export interface GuardrailConfig {
  promptFirewall: {
    enabled: boolean;
    blockedPatterns: RegExp[];
  };
  domainPolicy: {
    enabled: boolean;
    allowedDomains?: string[];
    deniedDomains?: string[];
  };
  rateLimits: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
  };
  piiScrubbing: {
    enabled: boolean;
    scrubPatterns: RegExp[];
  };
}

export class GuardrailsService {
  private config: GuardrailConfig;
  private requestCounts: Map<string, { minute: number[]; hour: number[] }> = new Map();

  constructor(config?: Partial<GuardrailConfig>) {
    this.config = {
      promptFirewall: {
        enabled: true,
        blockedPatterns: [
          /delete\s+all\s+data/i,
          /format\s+disk/i,
          /shutdown\s+system/i,
          /sudo\s+rm\s+-rf/i,
          // Add more dangerous patterns
        ],
      },
      domainPolicy: {
        enabled: false,
      },
      rateLimits: {
        enabled: true,
        maxRequestsPerMinute: 30,
        maxRequestsPerHour: 1000,
      },
      piiScrubbing: {
        enabled: true,
        scrubPatterns: [
          /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
          /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email (optional)
          /\b\d{3}-\d{3}-\d{4}\b/g, // Phone
        ],
      },
      ...config,
    };
  }

  /**
   * Check if a prompt is safe
   */
  async checkPrompt(prompt: string): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.config.promptFirewall.enabled) {
      return { allowed: true };
    }

    // Check blocked patterns
    for (const pattern of this.config.promptFirewall.blockedPatterns) {
      if (pattern.test(prompt)) {
        return {
          allowed: false,
          reason: `Prompt contains blocked pattern: ${pattern.source}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if a domain is allowed
   */
  async checkDomain(url: string): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.config.domainPolicy.enabled) {
      return { allowed: true };
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Check denied domains
      if (this.config.domainPolicy.deniedDomains) {
        for (const denied of this.config.domainPolicy.deniedDomains) {
          if (hostname.includes(denied) || hostname === denied) {
            return {
              allowed: false,
              reason: `Domain ${hostname} is in denied list`,
            };
          }
        }
      }

      // Check allowed domains (if whitelist mode)
      if (this.config.domainPolicy.allowedDomains && this.config.domainPolicy.allowedDomains.length > 0) {
        const isAllowed = this.config.domainPolicy.allowedDomains.some(
          allowed => hostname.includes(allowed) || hostname === allowed
        );
        if (!isAllowed) {
          return {
            allowed: false,
            reason: `Domain ${hostname} is not in allowed list`,
          };
        }
      }

      return { allowed: true };
    } catch {
      return { allowed: false, reason: 'Invalid URL' };
    }
  }

  /**
   * Check rate limits
   */
  async checkRateLimit(identifier: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    if (!this.config.rateLimits.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    let counts = this.requestCounts.get(identifier);
    if (!counts) {
      counts = { minute: [], hour: [] };
      this.requestCounts.set(identifier, counts);
    }

    // Clean old entries
    counts.minute = counts.minute.filter(t => now - t < 60000);
    counts.hour = counts.hour.filter(t => now - t < 3600000);

    // Check limits
    if (counts.minute.length >= this.config.rateLimits.maxRequestsPerMinute) {
      const oldestMinute = Math.min(...counts.minute);
      const retryAfter = Math.ceil((60000 - (now - oldestMinute)) / 1000);
      return {
        allowed: false,
        retryAfter,
      };
    }

    if (counts.hour.length >= this.config.rateLimits.maxRequestsPerHour) {
      const oldestHour = Math.min(...counts.hour);
      const retryAfter = Math.ceil((3600000 - (now - oldestHour)) / 1000);
      return {
        allowed: false,
        retryAfter,
      };
    }

    // Record request
    counts.minute.push(now);
    counts.hour.push(now);

    return { allowed: true };
  }

  /**
   * Scrub PII from text
   */
  scrubPII(text: string): string {
    if (!this.config.piiScrubbing.enabled) {
      return text;
    }

    let scrubbed = text;
    for (const pattern of this.config.piiScrubbing.scrubPatterns) {
      scrubbed = scrubbed.replace(pattern, '[REDACTED]');
    }

    return scrubbed;
  }

  /**
   * Validate a plan step
   */
  async validateStep(step: PlanStep): Promise<{ allowed: boolean; reason?: string }> {
    // Check prompt if step contains user input
    if (step.args && typeof step.args === 'object') {
      for (const [key, value] of Object.entries(step.args)) {
        if (typeof value === 'string') {
          // Check prompt firewall
          const promptCheck = await this.checkPrompt(value);
          if (!promptCheck.allowed) {
            return {
              allowed: false,
              reason: promptCheck.reason,
            };
          }

          // Scrub PII
          if (key === 'query' || key === 'text' || key === 'prompt') {
            (step.args as any)[key] = this.scrubPII(value);
          }

          // Check domain if URL
          if (key === 'url' || (typeof value === 'string' && value.startsWith('http'))) {
            const domainCheck = await this.checkDomain(value);
            if (!domainCheck.allowed) {
              return {
                allowed: false,
                reason: domainCheck.reason,
              };
            }
          }
        }
      }
    }

    // Check rate limit
    const rateCheck = await this.checkRateLimit(step.action);
    if (!rateCheck.allowed) {
      return {
        allowed: false,
        reason: `Rate limit exceeded. Retry after ${rateCheck.retryAfter}s`,
      };
    }

    return { allowed: true };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GuardrailConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      promptFirewall: {
        ...this.config.promptFirewall,
        ...config.promptFirewall,
      },
      domainPolicy: {
        ...this.config.domainPolicy,
        ...config.domainPolicy,
      },
      rateLimits: {
        ...this.config.rateLimits,
        ...config.rateLimits,
      },
      piiScrubbing: {
        ...this.config.piiScrubbing,
        ...config.piiScrubbing,
      },
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): GuardrailConfig {
    return { ...this.config };
  }
}

// Singleton instance
let guardrailsInstance: GuardrailsService | null = null;

export function getGuardrails(): GuardrailsService {
  if (!guardrailsInstance) {
    guardrailsInstance = new GuardrailsService();
  }
  return guardrailsInstance;
}

