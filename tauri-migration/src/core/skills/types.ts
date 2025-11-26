/**
 * Skill Store Types
 * Defines the structure for AI skills/agents that can be shared and installed
 */

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  icon?: string;
  category: SkillCategory;
  tags: string[];
  language?: string; // For Indic language skills
  rating?: number;
  reviewCount?: number;
  downloadCount?: number;
  createdAt: number;
  updatedAt: number;
  compatibility: {
    minVersion: string;
    maxVersion?: string;
  };
}

export type SkillCategory =
  | 'automation'
  | 'research'
  | 'trade'
  | 'productivity'
  | 'creative'
  | 'utility'
  | 'custom';

export interface SkillConfig {
  metadata: SkillMetadata;
  code: string; // WASM binary or JavaScript/TypeScript code
  dependencies?: string[];
  permissions?: SkillPermission[];
  triggers?: SkillTrigger[];
}

export interface SkillPermission {
  type: 'web' | 'file' | 'clipboard' | 'camera' | 'mic' | 'location';
  scope?: string;
  description: string;
}

export interface SkillTrigger {
  type: 'voice' | 'hotkey' | 'button' | 'auto' | 'scheduled';
  pattern?: string; // For voice triggers
  hotkey?: string; // For hotkey triggers
  schedule?: string; // Cron-like for scheduled
}

export interface SkillExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  logs?: string[];
}

export interface SkillReview {
  id: string;
  skillId: string;
  userId: string;
  userName?: string;
  rating: number; // 1-5
  comment: string;
  createdAt: number;
  helpful?: number;
}

export interface SkillInstallation {
  skillId: string;
  installedAt: number;
  enabled: boolean;
  config?: Record<string, any>;
}
