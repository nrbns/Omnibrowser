/**
 * Profile System
 * Manages multi-profile containers with isolated sessions
 */

import { BrowserWindow, session, Session } from 'electron';
import { randomUUID } from 'node:crypto';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import {
  ProfileCreateRequest,
  Profile,
  ProfilePolicy as ProfilePolicySchema,
  ProfileSetActiveRequest,
  ProfilePolicyRequest,
  ProxyProfile,
} from '../shared/ipc/schema';

export interface ProfileData {
  id: string;
  name: string;
  createdAt: number;
  partition: string;
  proxy?: ProxyProfile;
  color?: string;
  kind: 'default' | 'work' | 'personal' | 'custom';
  system?: boolean;
  description?: string;
  policy: ProfilePolicy;
}

export interface ProfilePolicy {
  allowDownloads: boolean;
  allowPrivateWindows: boolean;
  allowGhostTabs: boolean;
  allowScreenshots: boolean;
  allowClipping: boolean;
}

const profiles = new Map<string, ProfileData>();
const sessions = new Map<string, Session>();
const activeByWindow = new Map<number, string>();
let initialized = false;

const DEFAULT_POLICY: ProfilePolicy = {
  allowDownloads: true,
  allowPrivateWindows: true,
  allowGhostTabs: true,
  allowScreenshots: true,
  allowClipping: true,
};

const WORK_POLICY: ProfilePolicy = {
  allowDownloads: false,
  allowPrivateWindows: false,
  allowGhostTabs: false,
  allowScreenshots: false,
  allowClipping: false,
};

const PERSONAL_POLICY: ProfilePolicy = {
  allowDownloads: true,
  allowPrivateWindows: true,
  allowGhostTabs: true,
  allowScreenshots: true,
  allowClipping: true,
};

/**
 * Create or update a profile record
 */
function ensureProfile(profile: ProfileData): ProfileData {
  if (!profiles.has(profile.id)) {
    const sess = session.fromPartition(profile.partition, { cache: false });
    sessions.set(profile.id, sess);
    profiles.set(profile.id, profile);
  } else {
    const existing = profiles.get(profile.id)!;
    profiles.set(profile.id, { ...existing, ...profile });
  }
  return profiles.get(profile.id)!;
}

/**
 * Initialize system profiles (default, work, personal)
 */
export function initializeProfiles(): void {
  if (initialized) return;
  initialized = true;

  ensureProfile({
    id: 'default',
    name: 'Default',
    createdAt: Date.now(),
    partition: 'persist:default',
    kind: 'default',
    system: true,
    color: '#3b82f6',
    policy: DEFAULT_POLICY,
    description: 'Standard browsing profile with no additional restrictions.',
  });

  ensureProfile({
    id: 'work',
    name: 'Work',
    createdAt: Date.now(),
    partition: 'persist:profile:work',
    kind: 'work',
    system: true,
    color: '#6366f1',
    policy: WORK_POLICY,
    description: 'Compliance-focused profile with policy locks for corporate use.',
  });

  ensureProfile({
    id: 'personal',
    name: 'Personal',
    createdAt: Date.now(),
    partition: 'persist:profile:personal',
    kind: 'personal',
    system: true,
    color: '#f97316',
    policy: PERSONAL_POLICY,
    description: 'Personal browsing profile with full feature access.',
  });
}

/**
 * Create a new user profile
 */
export function createProfile(name: string, proxy?: ProxyProfile, color?: string): ProfileData {
  const id = randomUUID();
  const createdAt = Date.now();
  const profile: ProfileData = {
    id,
    name,
    createdAt,
    partition: `persist:profile:${id}`,
    proxy,
    color: color || randomColor(),
    kind: 'custom',
    system: false,
    policy: DEFAULT_POLICY,
  };
  return ensureProfile(profile);
}

/**
 * Get profile by ID
 */
export function getProfile(id: string): ProfileData | undefined {
  return profiles.get(id);
}

/**
 * Get profile session
 */
export function getProfileSession(id: string): Session | undefined {
  return sessions.get(id);
}

/**
 * List all profiles
 */
export function listProfiles(): ProfileData[] {
  return Array.from(profiles.values()).sort((a, b) => {
    const systemDelta = Number(!!b.system) - Number(!!a.system);
    if (systemDelta !== 0) return systemDelta;
    return a.createdAt - b.createdAt;
  });
}

/**
 * Delete a profile
 */
export function deleteProfile(id: string): boolean {
  const profile = profiles.get(id);
  if (!profile) return false;
  if (profile.system) return false;
  
  // Clear session data
  const sess = sessions.get(id);
  if (sess) {
    sess.clearStorageData().catch(() => {});
    sessions.delete(id);
  }
  
  profiles.delete(id);
  return true;
}

/**
 * Update profile proxy
 */
export function updateProfileProxy(profileId: string, proxy?: ProxyProfile): boolean {
  const profile = profiles.get(profileId);
  if (!profile) return false;
  
  profile.proxy = proxy;
  profiles.set(profileId, profile);
  return true;
}

/**
 * Get profile partition string for tab creation
 */
export function getProfilePartition(profileId: string): string | null {
  const profile = profiles.get(profileId);
  return profile?.partition || null;
}

/**
 * Get active profile for a BrowserWindow
 */
export function getActiveProfileForWindow(win: BrowserWindow | null): ProfileData {
  if (!win) {
    return profiles.get('default')!;
  }
  const currentId = activeByWindow.get(win.id) || 'default';
  return profiles.get(currentId) || profiles.get('default')!;
}

/**
 * Set active profile for a BrowserWindow
 */
export function setActiveProfileForWindow(win: BrowserWindow, profileId: string): ProfileData {
  const profile = profiles.get(profileId) || profiles.get('default')!;
  activeByWindow.set(win.id, profile.id);
  (win as any).__ob_activeProfileId = profile.id;
  return profile;
}

/**
 * Remove window record on close
 */
export function removeWindow(winId: number): void {
  activeByWindow.delete(winId);
}

/**
 * Get policy for profile id (defaults to profile policy)
 */
export function getProfilePolicy(profileId: string): ProfilePolicy {
  const profile = profiles.get(profileId) || profiles.get('default')!;
  return profile.policy;
}

export type ProfilePolicyAction = 'downloads' | 'private-window' | 'ghost-tab' | 'screenshot' | 'clip';

export function profileAllows(profileId: string, action: ProfilePolicyAction): boolean {
  const policy = getProfilePolicy(profileId);
  switch (action) {
    case 'downloads':
      return policy.allowDownloads;
    case 'private-window':
      return policy.allowPrivateWindows;
    case 'ghost-tab':
      return policy.allowGhostTabs;
    case 'screenshot':
      return policy.allowScreenshots;
    case 'clip':
      return policy.allowClipping;
    default:
      return true;
  }
}

function randomColor(): string {
  const palette = ['#0ea5e9', '#a855f7', '#22c55e', '#f97316', '#f43f5e', '#14b8a6', '#8b5cf6'];
  return palette[Math.floor(Math.random() * palette.length)];
}

/**
 * Register IPC handlers for profiles
 */
export function registerProfileIpc(): void {
  registerHandler('profiles:create', ProfileCreateRequest, async (_event, request) => {
    const profile = createProfile(request.name, request.proxy, request.color);
    return {
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt,
      proxy: profile.proxy,
      kind: profile.kind,
      color: profile.color,
      system: profile.system,
      policy: profile.policy,
      description: profile.description,
    } as Profile;
  });

  registerHandler('profiles:list', z.object({}), async () => {
    return listProfiles().map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      proxy: p.proxy,
      kind: p.kind,
      color: p.color,
      system: p.system,
      policy: p.policy,
      description: p.description,
    })) as Profile[];
  });

  registerHandler('profiles:get', z.object({ id: z.string() }), async (_event, request) => {
    const profile = getProfile(request.id);
    if (!profile) {
      throw new Error('Profile not found');
    }
    return {
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt,
      proxy: profile.proxy,
      kind: profile.kind,
      color: profile.color,
      system: profile.system,
      policy: profile.policy,
      description: profile.description,
    } as Profile;
  });

  registerHandler('profiles:delete', z.object({ id: z.string() }), async (_event, request) => {
    return { success: deleteProfile(request.id) };
  });

  registerHandler('profiles:updateProxy', z.object({
    profileId: z.string(),
    proxy: ProxyProfile.optional(),
  }), async (_event, request) => {
    return { success: updateProfileProxy(request.profileId, request.proxy) };
  });

  registerHandler('profiles:setActive', ProfileSetActiveRequest, async (event, request) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      throw new Error('No window available for profile activation');
    }
    const profile = setActiveProfileForWindow(win, request.profileId);

    const profileForSessions = getProfile(profile.id);
    const sessionManager = require('./sessions').getSessionManager() as {
      getSessionForProfile: (profileId: string) => any;
      createSession: (name: string, profileId?: string, color?: string) => any;
      setActiveSession: (sessionId: string) => void;
    };

    let session = sessionManager.getSessionForProfile(profile.id);
    if (!session) {
      session = sessionManager.createSession(profile.name, profile.id, profile.color);
    }
    sessionManager.setActiveSession(session.id);

    try {
      win.webContents.send('profiles:active', {
        profileId: profile.id,
        profile: {
          id: profile.id,
          name: profile.name,
          color: profile.color,
          kind: profile.kind,
          system: profile.system,
          policy: profile.policy,
          description: profile.description,
        },
      });
    } catch (error) {
      console.warn('[Profiles] Failed to emit active profile event', error);
    }

    return {
      id: profile.id,
      name: profile.name,
      color: profile.color,
      kind: profile.kind,
      system: profile.system,
      policy: profile.policy,
      description: profile.description,
    };
  });

  registerHandler('profiles:getActive', z.object({}), async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const profile = getActiveProfileForWindow(win || null);
    return {
      id: profile.id,
      name: profile.name,
      color: profile.color,
      kind: profile.kind,
      system: profile.system,
      policy: profile.policy,
      description: profile.description,
    };
  });

  registerHandler('profiles:getPolicy', ProfilePolicyRequest, async (_event, request) => {
    const profileId = request.profileId ?? 'default';
    const policy = getProfilePolicy(profileId);
    return ProfilePolicySchema.parse(policy);
  });
}

