/**
 * Policy Service - Domain allow/deny lists and action policies
 * Per-workspace domain policies for agent actions
 */

export interface DomainPolicy {
  enabled: boolean;
  allowedDomains?: string[];
  deniedDomains?: string[];
  mode?: 'whitelist' | 'blacklist'; // whitelist = only allowed, blacklist = deny listed
}

export interface PolicyConfig {
  domainPolicy?: DomainPolicy;
  workspacePolicies?: Map<string, DomainPolicy>; // Per-workspace policies
}

class PolicyService {
  private config: PolicyConfig = {
    domainPolicy: {
      enabled: false,
      mode: 'blacklist',
      deniedDomains: [],
      allowedDomains: [],
    },
    workspacePolicies: new Map(),
  };

  /**
   * Check if domain is allowed for a workspace
   */
  checkDomain(url: string, workspaceId?: string): { allowed: boolean; reason?: string } {
    // Get workspace-specific policy if provided
    const policy = workspaceId 
      ? this.config.workspacePolicies?.get(workspaceId) || this.config.domainPolicy
      : this.config.domainPolicy;

    if (!policy || !policy.enabled) {
      return { allowed: true };
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check blacklist mode
      if (policy.mode === 'blacklist' && policy.deniedDomains) {
        for (const denied of policy.deniedDomains) {
          if (hostname.includes(denied.toLowerCase()) || hostname === denied.toLowerCase()) {
            return {
              allowed: false,
              reason: `Domain ${hostname} is denied by policy`,
            };
          }
        }
      }

      // Check whitelist mode
      if (policy.mode === 'whitelist' && policy.allowedDomains) {
        const isAllowed = policy.allowedDomains.some(
          allowed => hostname.includes(allowed.toLowerCase()) || hostname === allowed.toLowerCase()
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
   * Set domain policy for a workspace
   */
  setWorkspacePolicy(workspaceId: string, policy: DomainPolicy): void {
    if (!this.config.workspacePolicies) {
      this.config.workspacePolicies = new Map();
    }
    this.config.workspacePolicies.set(workspaceId, policy);
  }

  /**
   * Get workspace policy
   */
  getWorkspacePolicy(workspaceId: string): DomainPolicy | undefined {
    return this.config.workspacePolicies?.get(workspaceId);
  }

  /**
   * Update global domain policy
   */
  setDomainPolicy(policy: DomainPolicy): void {
    this.config.domainPolicy = policy;
  }

  /**
   * Get current policy config
   */
  getConfig(): PolicyConfig {
    return { ...this.config };
  }
}

// Legacy function for compatibility
export function policyAllows(step: { skill: string; args: any }): boolean {
  // Tighten later: robots, rate limits, per-action caps
  const banned = new Set<string>(['solve_captcha']);
  if (banned.has(step.skill)) return false;
  return true;
}

// New policy service singleton
let policyServiceInstance: PolicyService | null = null;

export function getPolicyService(): PolicyService {
  if (!policyServiceInstance) {
    policyServiceInstance = new PolicyService();
  }
  return policyServiceInstance;
}


