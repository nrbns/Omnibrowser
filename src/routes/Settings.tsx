import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Compass,
  Shield,
  Palette,
  MonitorSmartphone,
  User,
  Sun,
  Moon,
  Laptop,
  Keyboard,
  Home,
  Lock,
  Globe,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { useSettingsStore } from '../state/settingsStore';
import type { AppState } from '../state/appStore';
import { showToast } from '../state/toastStore';
import { useSessionStore } from '../state/sessionStore';
import { useHistoryStore } from '../state/historyStore';
import { useTabsStore } from '../state/tabsStore';

const MODE_OPTIONS: AppState['mode'][] = ['Browse', 'Research', 'Trade', 'Games', 'Docs', 'Images', 'Threats', 'GraphMind'];

const TABS = [
  { id: 'general', label: 'General', icon: Home, description: 'Startup, search & telemetry' },
  { id: 'privacy', label: 'Privacy', icon: Shield, description: 'Tracking & storage' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and layout' },
  { id: 'accounts', label: 'Accounts', icon: User, description: 'Profile & sync' },
] as const;

const SHORTCUTS = [
  { combo: 'Ctrl/Cmd + T', action: 'Open new tab' },
  { combo: 'Ctrl/Cmd + W', action: 'Close current tab' },
  { combo: 'Ctrl/Cmd + Shift + T', action: 'Reopen last closed tab' },
  { combo: 'Ctrl/Cmd + Tab', action: 'Next tab in current mode' },
  { combo: 'Ctrl/Cmd + Shift + Tab', action: 'Previous tab' },
  { combo: 'Ctrl/Cmd + 1–9', action: 'Jump to tab position' },
  { combo: 'Ctrl/Cmd + L', action: 'Focus address bar' },
  { combo: 'Ctrl/Cmd + Enter', action: 'Smart-complete URL' },
];

const SEARCH_ENGINES = [
  { id: 'duckduckgo', label: 'DuckDuckGo' },
  { id: 'google', label: 'Google' },
  { id: 'bing', label: 'Bing' },
  { id: 'yahoo', label: 'Yahoo' },
  { id: 'all', label: 'All engines (burst)' },
] as const;

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Laptop },
] as const;

const ACCENT_OPTIONS = [
  { id: 'purple', label: 'Aurora', className: 'from-purple-500 to-indigo-500' },
  { id: 'blue', label: 'Pacific', className: 'from-blue-500 to-cyan-500' },
  { id: 'emerald', label: 'Grove', className: 'from-emerald-500 to-lime-500' },
] as const;

export default function SettingsRoute() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('general');

  return (
    <div className="flex h-full min-h-0 bg-slate-950 text-slate-100">
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-900/80 bg-slate-950/80 px-4 py-6 lg:flex lg:flex-col">
        <h1 className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Settings</h1>
        <div className="mt-5 space-y-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                activeTab === tab.id ? 'bg-slate-900 text-white shadow-inner shadow-slate-900/50' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <div className="font-medium">{tab.label}</div>
                <p className="text-xs text-slate-500">{tab.description}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-auto rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-4 text-xs text-slate-400">
          Need deeper controls? Advanced networking + diagnostics live in the desktop console.
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-900/60 bg-slate-950/70 px-4 py-3 shadow-sm shadow-black/40 lg:hidden">
          <select
            value={activeTab}
            onChange={(event) => setActiveTab(event.target.value as (typeof TABS)[number]['id'])}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"
          >
            {TABS.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-10" style={{ gap: 'var(--regen-panel-gap, 1.25rem)' }}>
          {activeTab === 'general' && <GeneralPanel />}
          {activeTab === 'privacy' && <PrivacyPanel />}
          {activeTab === 'appearance' && <AppearancePanel />}
          {activeTab === 'accounts' && <AccountsPanel />}
        </div>
      </main>
    </div>
  );
}

function GeneralPanel() {
  const general = useSettingsStore((state) => state.general);
  const updateGeneral = useSettingsStore((state) => state.updateGeneral);
  const searchEngine = useSettingsStore((state) => state.searchEngine);
  const setSearchEngine = useSettingsStore((state) => state.setSearchEngine);

  const modeOptions = useMemo(
    () =>
      MODE_OPTIONS.map((mode) => (
        <option key={mode} value={mode}>
          {mode}
        </option>
      )),
    [],
  );

  return (
    <div className="space-y-6">
      <SectionCard
        title="Startup & defaults"
        description="Pick how ReGen boots and what it launches first."
        icon={Compass}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField label="Default mode" description="Controls which workspace opens first.">
            <select
              value={general.defaultMode}
              onChange={(event) => updateGeneral({ defaultMode: event.target.value as AppState['mode'] })}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
            >
              {modeOptions}
            </select>
          </LabeledField>
          <LabeledField label="On startup" description="Open a new tab or pick up where you left off.">
            <div className="flex gap-3">
              {['newTab', 'restore'].map((value) => (
                <button
                  key={value}
                  onClick={() => updateGeneral({ startupBehavior: value as 'newTab' | 'restore' })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                    general.startupBehavior === value
                      ? 'border-purple-400 bg-purple-500/10 text-white'
                      : 'border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {value === 'newTab' ? 'Start fresh' : 'Restore session'}
                </button>
              ))}
            </div>
          </LabeledField>
        </div>
        <LabeledField label="Preferred search engine" description="Used for address bar completions and quick searches.">
          <div className="grid gap-3 sm:grid-cols-3">
            {SEARCH_ENGINES.map((engine) => (
              <button
                key={engine.id}
                onClick={() => setSearchEngine(engine.id as any)}
                className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                  searchEngine === engine.id
                    ? 'border-emerald-400/80 bg-emerald-500/10 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                    : 'border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-semibold">{engine.label}</div>
                {engine.id === 'all' ? (
                  <p className="text-xs text-emerald-200/80">Opens bursts across engines</p>
                ) : (
                  <p className="text-xs text-slate-500">Route queries through {engine.label}</p>
                )}
              </button>
            ))}
          </div>
        </LabeledField>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleRow
            label="Share anonymous telemetry"
            description="Helps prioritize bugs and keeps agents healthy."
            value={general.telemetryOptIn}
            onChange={(checked) => updateGeneral({ telemetryOptIn: checked })}
          />
          <ToggleRow
            label="Show keyboard hints"
            description="Display shortcuts under key buttons."
            value={general.showKeyboardHints}
            onChange={(checked) => updateGeneral({ showKeyboardHints: checked })}
          />
        </div>
      </SectionCard>
      <KeyboardShortcutsCard />
    </div>
  );
}

function PrivacyPanel() {
  const privacy = useSettingsStore((state) => state.privacy);
  const updatePrivacy = useSettingsStore((state) => state.updatePrivacy);
  const videoConsent = useSettingsStore((state) => state.videoDownloadConsent);
  const setConsent = useSettingsStore((state) => state.setConsent);
  const sessionSnapshot = useSessionStore((state) => state.snapshot);
  const restoreSessionSnapshot = useSessionStore((state) => state.restoreFromSnapshot);
  const clearSessionSnapshot = useSessionStore((state) => state.clearSnapshot);
  const clearHistoryEntries = useHistoryStore((state) => state.clear);
  const clearRecentlyClosed = useTabsStore((state) => state.clearRecentlyClosed);
  const [restoring, setRestoring] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleRestore = async () => {
    if (!sessionSnapshot) {
      showToast('info', 'No saved session to restore.');
      return;
    }
    setRestoring(true);
    try {
      const result = await restoreSessionSnapshot();
      if (result.restored) {
        showToast('success', `Restored ${result.tabCount} tab${result.tabCount === 1 ? '' : 's'}.`);
      } else {
        showToast('error', 'Snapshot missing tabs to restore.');
      }
    } catch (error) {
      console.error('[Settings] Failed to restore snapshot:', error);
      showToast('error', 'Failed to restore previous session.');
    } finally {
      setRestoring(false);
    }
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      clearHistoryEntries();
      clearSessionSnapshot();
      clearRecentlyClosed();
      showToast('success', 'Browsing data cleared.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Privacy controls"
        description="Decide how much data leaves this machine."
        icon={Shield}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleRow
            label="Local-only mode"
            description="Keep sessions, caches, and AI context on-device only."
            value={privacy.localOnlyMode}
            onChange={(checked) => updatePrivacy({ localOnlyMode: checked })}
          />
          <ToggleRow
            label="Do Not Track"
            description="Send DNT headers on every request."
            value={privacy.doNotTrack}
            onChange={(checked) => updatePrivacy({ doNotTrack: checked })}
          />
          <ToggleRow
            label="Clear data on exit"
            description="Erase browsing history, tabs, and memory when closing ReGen."
            value={privacy.clearOnExit}
            onChange={(checked) => updatePrivacy({ clearOnExit: checked })}
          />
          <ToggleRow
            label="Block 3rd-party cookies"
            description="Stronger isolation for ad + tracker networks."
            value={privacy.blockThirdPartyCookies}
            onChange={(checked) => updatePrivacy({ blockThirdPartyCookies: checked })}
          />
        </div>
        <div className="rounded-xl border border-slate-900/60 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <Lock className="h-4 w-4 text-amber-400" />
            <span>Video download consent</span>
            <button
              onClick={() => setConsent(!videoConsent)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                videoConsent ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {videoConsent ? 'Allowed' : 'Blocked'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Required for agent workflows that cache video transcripts locally.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Session & cache"
        description="Manage stored tabs, memory, and AI context."
        icon={MonitorSmartphone}
      >
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRestore}
            disabled={!sessionSnapshot || restoring}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
              !sessionSnapshot || restoring
                ? 'border-slate-900 text-slate-500 cursor-not-allowed'
                : 'border-slate-800 text-slate-200 hover:border-purple-500/70'
            }`}
          >
            <RefreshIcon />
            {restoring ? 'Restoring…' : 'Restore previous session'}
          </button>
          <button
            onClick={handleClearData}
            disabled={clearing}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
              clearing ? 'border-slate-900 text-slate-500 cursor-wait' : 'border-slate-800 text-slate-200 hover:border-rose-500/70'
            }`}
          >
            <TrashIcon />
            {clearing ? 'Clearing…' : 'Clear browsing data'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {sessionSnapshot
            ? `Last saved ${formatDistanceToNow(new Date(sessionSnapshot.updatedAt), { addSuffix: true })}`
            : 'Snapshots appear automatically once you have tabs open.'}
        </p>
      </SectionCard>
    </div>
  );
}

function AppearancePanel() {
  const appearance = useSettingsStore((state) => state.appearance);
  const updateAppearance = useSettingsStore((state) => state.updateAppearance);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Theme"
        description="Choose how the canvas looks."
        icon={Palette}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => updateAppearance({ theme: option.id as typeof appearance.theme })}
              className={`rounded-2xl border px-4 py-5 text-left transition ${
                appearance.theme === option.id
                  ? 'border-sky-400 bg-sky-500/10 text-white shadow-[0_0_20px_rgba(14,165,233,0.2)]'
                  : 'border-slate-800 text-slate-200 hover:border-slate-600'
              }`}
            >
              <option.icon className="h-5 w-5 text-sky-300" />
              <div className="mt-4 text-sm font-semibold">{option.label}</div>
              {option.id === 'system' && <p className="text-xs text-slate-400">Tracks OS preference</p>}
            </button>
          ))}
        </div>
        <div className="mt-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accent</span>
          <div className="mt-3 flex flex-wrap gap-3">
            {ACCENT_OPTIONS.map((accent) => (
              <button
                key={accent.id}
                onClick={() => updateAppearance({ accent: accent.id as typeof appearance.accent })}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                  appearance.accent === accent.id ? 'border-white text-white' : 'border-transparent text-slate-300'
                }`}
              >
                <span className={`inline-flex h-5 w-5 rounded-full bg-gradient-to-br ${accent.className}`} />
                {accent.label}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Layout density"
        description="Tune how much fits on screen."
        icon={MonitorSmartphone}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleRow
            label="Compact UI"
            description="Tighter spacing for 13” laptops."
            value={appearance.compactUI}
            onChange={(checked) => updateAppearance({ compactUI: checked })}
          />
          <ToggleRow
            label="Show tab numbers"
            description="Display Chrome-style numeric shortcuts."
            value={appearance.showTabNumbers}
            onChange={(checked) => updateAppearance({ showTabNumbers: checked })}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function AccountsPanel() {
  const account = useSettingsStore((state) => state.account);
  const updateAccount = useSettingsStore((state) => state.updateAccount);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Profile"
        description="Update name, workspace, and identity."
        icon={User}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField label="Display name">
            <input
              value={account.displayName}
              onChange={(event) => updateAccount({ displayName: event.target.value })}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
            />
          </LabeledField>
          <LabeledField label="Workspace">
            <input
              value={account.workspace}
              onChange={(event) => updateAccount({ workspace: event.target.value })}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
            />
          </LabeledField>
          <LabeledField label="Email address">
            <input
              type="email"
              value={account.email}
              onChange={(event) => updateAccount({ email: event.target.value })}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
            />
          </LabeledField>
          <LabeledField label="Avatar URL">
            <input
              value={account.avatarUrl ?? ''}
              onChange={(event) => updateAccount({ avatarUrl: event.target.value })}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
            />
          </LabeledField>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Last synced {account.lastSyncedAt ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(account.lastSyncedAt) : 'just now'}
        </div>
      </SectionCard>

      <SectionCard
        title="Connected services"
        description="OAuth + extension bridges land here later."
        icon={Globe}
      >
        <button
          onClick={() => showToast('info', 'Extension API coming soon')}
          className="rounded-lg border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400 hover:border-slate-500 hover:text-white"
        >
          + Connect service
        </button>
      </SectionCard>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-900/40 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-2xl bg-slate-900/80 p-3 text-purple-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function LabeledField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-200">
      <span className="font-semibold">{label}</span>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-900/70 bg-slate-900/60 px-4 py-3">
      <div className="pr-4">
        <div className="text-sm font-medium text-white">{label}</div>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
          value ? 'bg-purple-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white transition ${
            value ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function KeyboardShortcutsCard() {
  return (
    <SectionCard
      title="Keyboard reference"
      description="Fast navigation across tabs, modes, and agents."
      icon={Keyboard}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.combo} className="flex items-center gap-3 rounded-2xl border border-slate-900/60 bg-slate-950/40 px-3 py-3">
            <kbd className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-xs font-semibold text-slate-200">
              {shortcut.combo}
            </kbd>
            <span className="text-sm text-slate-300">{shortcut.action}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function RefreshIcon() {
  return <Sparkles className="h-4 w-4 text-purple-300" />;
}

function TrashIcon() {
  return <Lock className="h-4 w-4 text-rose-300" />;
}

