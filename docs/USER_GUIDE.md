# OmniBrowser User Guide (Privacy & Consent Edition)

_Updated: 2025-11-08_

This guide complements the Consent Ledger Tour and focuses on privacy settings users can configure after installation. It will expand to cover research, document review, and agent workflows as Phase A tasks land.

---

## 1. Quick Start

After installation:

1. Run through the [Consent Ledger Tour](consent-ledger-tour.md).
2. Open **Settings → Privacy & Consent** to pick a preset (Strict, Balanced, Relaxed).
3. Verify your profile (Work, Personal, Custom) in the top navigation bar.

---

## 2. Privacy Controls

### 2.1 Privacy Presets

| Preset | Description | Default Behaviors |
|--------|-------------|-------------------|
| **Strict** | Maximum privacy, minimal automation. | Blocks all cloud AI calls, disallows downloads without prompt, disables screenshots, wipes storage on exit. |
| **Balanced** | Recommended for research workflows. | Allows local AI, prompts for cloud fallback, enables downloads with ledger entries, retains history for 7 days. |
| **Relaxed** | Convenience-oriented. | Allows cloud AI, enables auto-downloads, keeps history indefinitely, telemetry opt-in prompt on first run. |

Presets are starting points—you can override individual toggles.

### 2.2 Consent Ledger Settings

- **Auto-expire consents:** Choose expiry windows (24h, 7d, 30d).  
- **Risk thresholds:** Set minimum risk that requires manual confirmation.  
- **Export/Delete:** Export ledger as JSON for audits; delete to reset tour and prompts.

### 2.3 Container Permissions

Open **Tools → Containers** to manage per-container permissions:

- Toggle `media`, `display-capture`, `notifications`, `fullscreen`.  
- View per-site overrides and revoke origins individually.

---

## 3. Profiles & Policy Locks

Profiles (Work, Personal, Custom) govern:

- **Policy Locks:** Whether private windows / ghost tabs / screenshots are allowed.  
- **Default Containers:** The container assigned to new tabs in that profile.  
- **Proxy Settings:** Each profile can have distinct proxy/VPN configs.

Profile switches live next to the session switcher in the top navigation bar. If a policy blocks an action, a toast appears with a “Learn more” link to the ledger.

---

## 4. Telemetry & Diagnostics

- **Telemetry Toggle:** Located under **Settings → Diagnostics**. Opt-in only; sends aggregated, anonymized metrics.  
- **Open Logs Folder:** Available from error boundaries, the diagnostics panel, and the quick actions menu.  
- **Copy Diagnostics:** Captures recent log snippets and system info for support requests.

---

## 5. Managing Downloads

Visit the Downloads panel (Top Nav → Tools → Downloads):

- Real-time status, safety badges (`Clean`, `Warning`, `Blocked`).  
- Pausing/resuming downloads updates the ledger with reasons.  
- Blocked downloads remain quarantined until you dismiss or restore.

Downloads obey profile policies—if a profile disallows downloads, a consent-block toast appears.

---

## 6. Research Mode & Containers (Preview)

Research mode now displays container badges and allows container-aware summary exports. Future updates will document:

- Tab split view / peek preview (Phase A).  
- Hibernation indicators for sleeping tabs (Phase A).  
- Accessibility improvements and dark/light theme toggles (Phase A).

---

## 7. Resetting OmniBrowser

If you need to reset the environment:

1. Use **Tools → Consent Ledger → Reset ledger**.  
2. Clear profiles under **Settings → Profiles**.  
3. Delete local app data directories (see platform-specific paths in the installation guide).  
4. Relaunch the app; the first-launch tour will reappear.

---

## 8. Feedback

While the docs are evolving, please report gaps or confusing flows via:

- GitHub Discussions (Beta Feedback)  
- Discord (link to be announced)  
- Email support (once Phase A onboarding tasks finish)

We’ll expand this guide to cover Research Mode, Document Review, Containers++, and diagnostics workflows as those features stabilize.

