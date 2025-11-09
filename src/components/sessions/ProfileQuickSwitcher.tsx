import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircle,
  Briefcase,
  Sparkles,
  Check,
  Download,
  EyeOff,
  Ghost,
  Camera,
  Scissors,
  Shield,
  Loader2,
  Plus,
} from 'lucide-react';
import { ensureProfilesLoaded, useProfileStore } from '../../state/profileStore';
import { ProfileInfo, ProfilePolicy } from '../../lib/ipc-events';
import { ipc } from '../../lib/ipc-typed';

type PolicyKey = keyof ProfilePolicy;

const POLICY_CONFIG: Array<{
  key: PolicyKey;
  label: string;
  icon: typeof Download;
  description: string;
}> = [
  {
    key: 'allowDownloads',
    label: 'Downloads',
    icon: Download,
    description: 'File downloads to local storage',
  },
  {
    key: 'allowPrivateWindows',
    label: 'Private windows',
    icon: EyeOff,
    description: 'Open dedicated private windows',
  },
  {
    key: 'allowGhostTabs',
    label: 'Ghost tabs',
    icon: Ghost,
    description: 'Create ephemeral ghost tabs',
  },
  {
    key: 'allowScreenshots',
    label: 'Screenshots',
    icon: Camera,
    description: 'Capture browser screenshots',
  },
  {
    key: 'allowClipping',
    label: 'Clip text',
    icon: Scissors,
    description: 'Use web clipper to capture highlights',
  },
];

const PROFILE_ICON: Record<string, typeof UserCircle> = {
  work: Briefcase,
  personal: Sparkles,
  default: UserCircle,
};

function getProfileIcon(profile: ProfileInfo) {
  if (profile.kind && PROFILE_ICON[profile.kind]) {
    return PROFILE_ICON[profile.kind];
  }
  return PROFILE_ICON.default;
}

function summarizePolicy(policy?: ProfilePolicy) {
  if (!policy) return 'Unknown policy';
  const restricted = POLICY_CONFIG.filter(({ key }) => !policy[key]);
  if (restricted.length === 0) {
    return 'All capabilities enabled';
  }
  if (restricted.length === POLICY_CONFIG.length) {
    return 'Strict mode: most features disabled';
  }
  return `Restricted: ${restricted.map((r) => r.label.toLowerCase()).join(', ')}`;
}

function sortProfiles(profiles: ProfileInfo[]) {
  return [...profiles].sort((a, b) => {
    const systemA = Number(!!a.system);
    const systemB = Number(!!b.system);
    if (systemA !== systemB) return systemB - systemA;
    const kindRank = (kind?: string) => {
      switch (kind) {
        case 'work':
          return 0;
        case 'personal':
          return 1;
        case 'default':
          return 2;
        default:
          return 3;
      }
    };
    const rankDelta = kindRank(a.kind) - kindRank(b.kind);
    if (rankDelta !== 0) return rankDelta;
    return a.name.localeCompare(b.name);
  });
}

function profileAccent(profile: ProfileInfo) {
  if (profile.color) {
    return profile.color;
  }
  switch (profile.kind) {
    case 'work':
      return '#4f46e5';
    case 'personal':
      return '#f97316';
    default:
      return '#3b82f6';
  }
}

export function ProfileQuickSwitcher() {
  const {
    profiles,
    activeProfileId,
    policies,
    loading,
    setActiveProfile,
    lastPolicyBlock,
    markPolicyMessageRead,
  } = useProfileStore((state) => ({
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
    policies: state.policies,
    loading: state.loading,
    setActiveProfile: state.setActiveProfile,
    lastPolicyBlock: state.lastPolicyBlock,
    markPolicyMessageRead: state.markPolicyMessageRead,
  }));
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);

  useEffect(() => {
    ensureProfilesLoaded();
  }, []);

  useEffect(() => {
    if (!open && creating) {
      setCreating(false);
      setNewName('');
    }
  }, [open, creating]);

  const activeProfile = useMemo(() => {
    return profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  }, [profiles, activeProfileId]);

  const policy = activeProfile ? policies[activeProfile.id] : undefined;

  const sortedProfiles = useMemo(() => sortProfiles(profiles), [profiles]);

  const handleSelect = async (profileId: string) => {
    if (profileId === activeProfileId) {
      setOpen(false);
      return;
    }
    try {
      setPendingProfileId(profileId);
      await setActiveProfile(profileId);
      setOpen(false);
    } catch (error) {
      console.error('Failed to switch profile', error);
    } finally {
      setPendingProfileId(null);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await ipc.profiles.create({ name });
      await useProfileStore.getState().loadProfiles(true);
      setCreating(false);
      setNewName('');
    } catch (error) {
      console.error('Failed to create profile', error);
    }
  };

  const isDefaultProfile =
    !activeProfile ||
    activeProfile.id === 'default' ||
    activeProfile.name.toLowerCase() === 'default';

  const showLabel = !isDefaultProfile;

  const buttonSpacing = showLabel ? 'gap-2 px-3' : 'gap-1.5 px-2.5';

  return (
    <div className="relative">
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={`flex items-center ${buttonSpacing} py-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-800/80 border border-gray-700/50 text-gray-300 hover:text-gray-100 transition-all`}
        title={activeProfile ? `${activeProfile.name} profile` : 'Profiles'}
      >
        {(() => {
          const Icon = activeProfile ? getProfileIcon(activeProfile) : UserCircle;
          return <Icon size={16} />;
        })()}
        {showLabel && (
          <span className="text-sm font-medium">
            {activeProfile ? activeProfile.name : 'Profiles'}
          </span>
        )}
        {!isDefaultProfile && activeProfile && (
          <span
            className="inline-flex h-2.5 w-2.5 rounded-full border border-gray-900/40"
            style={{ backgroundColor: profileAccent(activeProfile) }}
          />
        )}
        {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-0 mt-2 w-72 bg-gray-900/95 backdrop-blur-xl border border-gray-800/60 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-gray-800/60 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-gray-500">Profiles</span>
              <button
                onClick={() => setCreating((v) => !v)}
                className="p-1.5 rounded-md hover:bg-gray-800/60 text-gray-400 hover:text-gray-100 transition-colors"
                title="Create new profile"
              >
                <Plus size={14} />
              </button>
            </div>

            {creating && (
              <div className="px-3 pb-3 border-b border-gray-800/60 space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Profile name"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreate();
                    } else if (e.key === 'Escape') {
                      setCreating(false);
                      setNewName('');
                    }
                  }}
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => {
                      setCreating(false);
                      setNewName('');
                    }}
                    className="text-xs text-gray-400 hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto divide-y divide-gray-800/50">
              {sortedProfiles.map((profile) => {
                const Icon = getProfileIcon(profile);
                const isActive = profile.id === activeProfileId;
                const policy = policies[profile.id];
                const restricted = policy
                  ? POLICY_CONFIG.filter(({ key }) => !policy[key])
                  : [];

                return (
                  <button
                    key={profile.id}
                    onClick={() => handleSelect(profile.id)}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      isActive
                        ? 'bg-blue-600/15 border-l-2 border-blue-500/60'
                        : 'hover:bg-gray-800/60 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-gray-200">
                      <span
                        className="inline-flex h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: profileAccent(profile) }}
                      />
                      <Icon size={16} className="text-gray-300" />
                      <span className="text-sm font-medium flex-1 truncate">{profile.name}</span>
                      {isActive && <Check size={14} className="text-blue-400" />}
                      {pendingProfileId === profile.id && (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {profile.description || summarizePolicy(policy)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {POLICY_CONFIG.map(({ key, label, icon: PolicyIcon }) => {
                        const allowed = policy ? policy[key] : true;
                        return (
                          <span
                            key={`${profile.id}-${key}`}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border ${
                              allowed
                                ? 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10'
                                : 'border-rose-500/40 text-rose-200 bg-rose-500/10 line-through decoration-rose-300/70'
                            }`}
                            title={POLICY_CONFIG.find((p) => p.key === key)?.description}
                          >
                            <PolicyIcon size={11} />
                            {label}
                          </span>
                        );
                      })}
                      {restricted.length === 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border border-emerald-400/40 text-emerald-200 bg-emerald-500/10">
                          <Shield size={11} />
                          Compliant
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {sortedProfiles.length === 0 && (
                <div className="px-3 py-4 text-xs text-gray-500 text-center">
                  No profiles yet. Create one to get started.
                </div>
              )}
            </div>

            {lastPolicyBlock && (
              <div className="px-3 py-2 border-t border-gray-800/60 bg-amber-500/10 text-xs text-amber-200 flex items-start gap-2">
                <Shield size={12} className="mt-0.5" />
                <div>
                  <div className="font-medium text-amber-100">Action blocked by policy</div>
                  <div className="mt-1 text-amber-200/80">
                    {lastPolicyBlock.action.replace('-', ' ')} is disabled for this profile.
                  </div>
                  <button
                    onClick={markPolicyMessageRead}
                    className="mt-2 text-[11px] text-amber-200 hover:text-amber-100 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

