# Consent Ledger Tour (First-Launch Walkthrough)

_Updated: 2025-11-08_

OmniBrowser records every high-risk action that requires explicit user consent (e.g., invoking cloud AI, downloading files, accessing camera/microphone). This guide describes the first-launch tour and the consent controls available afterwards.

---

## Tour Overview

The first time OmniBrowser launches, the Consent Ledger Tour appears as a four-step modal overlay:

1. **Why Consent Matters**  
   - Summary of OmniBrowser’s privacy stance.  
   - Visual indicator showing the ledger icon that appears whenever consent is logged.

2. **Reviewing Pending Requests**  
   - Demonstrates the consent prompt UI (“Allow once”, “Always allow”, “Deny”).  
   - Highlights the risk badge (`Low`, `Medium`, `High`) and link to detailed metadata.

3. **Ledger History Panel**  
   - Shows how to open the ledger (Top Nav → Tools → Consent Ledger).  
   - Describes filters by action type, risk level, and time range.

4. **Revoking Consent**  
   - Explains the “Forget” button (revokes stored consent records).  
   - Reminds users they can export or delete the ledger any time.

Each step includes a “Next” button and a “Skip tour” option. Once completed or skipped, the tour won’t auto-run again unless the user resets the ledger.

---

## Accessing the Ledger After the Tour

1. Open the top navigation bar’s **Tools** menu.  
2. Select **Consent Ledger**.  
3. Use the sidebar filters to view entries by:
   - Action type (e.g., `ai_cloud`, `download`, `access_camera`).  
   - Risk (`Low`, `Medium`, `High`).  
   - Time (Last 24h, 7 days, 30 days, custom).

You can export the ledger as JSON via the **Export** button, or clear all entries with **Reset ledger**.

---

## Customizing Consent Behavior

- **Per-Action Defaults:** In **Settings → Privacy & Consent**, choose defaults for downloads, AI calls, or device access.  
- **Risk Thresholds:** Set minimum risk levels that require manual confirmation.  
- **Toast Notifications:** Enable/disable passive notifications when consent is auto-approved based on prior decisions.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tour didn’t appear on first launch | Reset the ledger in **Settings → Privacy & Consent** and relaunch. |
| Consent prompts reappear despite “Always allow” | Ledger may have been reset or expired. Re-approve from the next prompt. |
| Ledger file corrupted | Delete the ledger file in the app data folder (`%APPDATA%/OmniBrowser/consent-ledger.json` on Windows, `~/Library/Application Support/OmniBrowser/consent-ledger.json` on macOS). |

---

## Next Steps

After completing the tour:

- Visit the [User Guide](USER_GUIDE.md#privacy-controls) to see detailed instructions for managing privacy and consent.
- Provide feedback on the tour flow via the beta community channel so we can refine the onboarding experience.

