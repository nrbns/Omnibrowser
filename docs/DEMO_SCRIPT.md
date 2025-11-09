# OmniBrowser × Redix — 3 Minute Demo Script

> Goal: capture a single-take screencast (≤3m) that highlights the regen loop, privacy stack, and memory recall. Use 1440p @ 60fps if possible. Narrate or add captions after recording.

## 0. Prep
1. Launch OmniBrowser beta build.
2. Ensure Tor toggle is off, VPN is disconnected, and regen mode is in `Normal`.
3. Open the following tabs (left → right):
   - `https://news.ycombinator.com/` (research example)
   - `https://s.tradingview.com/widgetembed/...` (TradingView widget to prove iframe proxy)
   - `https://omni.local/welcome` (internal blank tab for OmniDesk)
4. Close any distracting notifications.

## 1. Opening Hook (0:00 – 0:25)
1. Show the top nav + status bar; mention “local-first, Redix-powered regen browser.”
2. Press `Ctrl+Shift+K` → omnibox; type `/calc 42*9` to show local action, hit Enter.
3. Press `Ctrl+Shift+K` again → type `@live regen mode benchmarks` to show streaming search via Redix. Let results stream for ~5 seconds.

## 2. Regen Mode in Action (0:25 – 1:30)
1. Open Bottom Status tooltip (hover) to highlight current battery (mock if needed).
2. Use Tools → `Regen Mode` to trigger `battery-saver`. Observe:
   - Efficiency badge flips color + badge text.
   - Efficiency alert toast with suggested actions.
3. Accept the alert: click “Hibernate background tabs.” Show hibernation indicator on inactive tab (faded state).
4. Switch back to `Normal` mode (Tools → Regen Mode → Normal). Mention frame-rate throttle toggles automatically.

## 3. Privacy Stack (1:30 – 2:15)
1. In status bar, click `Tor: Off` button → enable. Confirm purple “Tor: On” badge.
2. In Top Nav → Security menu, highlight `Tor: Disable` + `Tor: New Identity`, but stay on (no need to renew).
3. Click `VPN` badge → narrate “VPN disconnected; monitors status if corporate tunnel is active.”
4. Open Consent Playground (Tools → Consent Playground). Show ledger entries, approve/revoke a pending request. Close overlay.

## 4. Memory Recall with Redix (2:15 – 2:50)
1. Focus omnibox (`Ctrl+L` / `Ctrl+Shift+K`).
2. Type `notes on regen prediction badge last hour` → highlight streaming results.
3. Click one memory result → show recall card (Portal).
4. Mention PII guardrails (write request with fake SSN returns 422) verbally; no need to demo on-screen.

## 5. Closing (2:50 – 3:00)
1. Toggle Tab Graph overlay (`Ctrl+Shift+G`). Briefly point to containers + relationships.
2. Close overlay; end on status bar showing “Tor On · Battery Saver Off · Regen +1.8h”.

## Post-production Notes
- Trim dead air; keep cuts minimal.
- Overlay callouts for keyboard shortcuts.
- Add outro card linking to README + beta signup.

