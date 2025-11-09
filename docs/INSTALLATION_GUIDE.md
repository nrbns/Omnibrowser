# OmniBrowser Installation Guide (Draft)

_Updated: 2025-11-08_

This document walks new beta users through downloading, installing, and launching OmniBrowser on supported platforms.

---

## 1. Prerequisites

| Platform | Minimum OS | Notes |
|----------|------------|-------|
| Windows  | Windows 10 (21H2) or newer, 64-bit | Administrator rights required for first install. |
| macOS    | macOS 13 Ventura or newer, Apple Silicon or Intel | Gatekeeper warning expected until code-signing is finalized. |
| Linux    | Ubuntu 22.04 LTS or newer (AppImage) | Requires `libfuse2` for AppImage mounting. |

All platforms require ~1.5 GB free disk space and an active Internet connection for the first launch to download language models or optional updates.

---

## 2. Downloading OmniBrowser

| Build Artifact | Description | Location |
|----------------|-------------|----------|
| `OmniBrowser-0.2.0-beta-win.exe` | Windows installer (NSIS) | _To be published in the release assets section of the GitHub repository._ |
| `OmniBrowser-0.2.0-beta.dmg` | macOS installer (DMG) | _To be published in the release assets section of the GitHub repository._ |
| `OmniBrowser-0.2.0-beta.AppImage` | Linux self-contained AppImage | _To be published in the release assets section of the GitHub repository._ |

> **Note:** Signed installers are still in progress. Until then, Windows SmartScreen and macOS Gatekeeper may display warnings.

---

## 3. Windows Installation

1. Download `OmniBrowser-0.2.0-beta-win.exe`.
2. Double-click the installer. If SmartScreen warns about an unrecognized app, choose **More info → Run anyway**.
3. Follow the NSIS prompts. Default install location is `%LOCALAPPDATA%\Programs\OmniBrowser`.
4. When installation completes, choose **Launch OmniBrowser** or use the Start Menu shortcut.

![Windows Installer Screenshot](./media/install/windows-installer.png) <!-- TODO: Capture and embed -->

### Portable Mode (Advanced)

If you prefer a portable install, run the installer with `/S /D=PATH` switches:

```powershell
.\OmniBrowser-0.2.0-beta-win.exe /S /D=C:\Tools\OmniBrowser
```

This skips UI prompts and installs to the specified directory.

---

## 4. macOS Installation

1. Download `OmniBrowser-0.2.0-beta.dmg`.
2. Double-click the DMG to mount it.
3. Drag the OmniBrowser icon into the **Applications** folder.
4. On first launch, macOS may warn that the app is from an unidentified developer. Open **System Settings → Privacy & Security** and click **Open Anyway**.

![macOS Drag-and-Drop Screenshot](./media/install/macos-dmg.png) <!-- TODO: Capture and embed -->

To uninstall, drag OmniBrowser from **Applications** to the Trash.

---

## 5. Linux Installation (AppImage)

1. Download `OmniBrowser-0.2.0-beta.AppImage`.
2. Make the file executable:

```bash
chmod +x OmniBrowser-0.2.0-beta.AppImage
```

3. Run the AppImage:

```bash
./OmniBrowser-0.2.0-beta.AppImage
```

For better desktop integration, use `--install` (requires `libfuse2`):

```bash
./OmniBrowser-0.2.0-beta.AppImage --install
```

---

## 6. First Launch Checklist

After the splash screen:

1. **Consent Ledger Tour**  
   A guided walkthrough highlights how OmniBrowser records consent. (See [Consent Ledger Tour](consent-ledger-tour.md).)

2. **Diagnostics & Privacy Settings**  
   Set your preferred privacy preset and telemetry toggle (see [Privacy Controls](USER_GUIDE.md#privacy-controls)).

3. **Profile Setup**  
   Choose the default browsing profile (Work, Personal, or Custom). Profiles govern policy locks and container defaults.

4. **Optional Local AI Setup**  
   If you plan to run local LLMs (e.g., via Ollama), configure them under **Settings → AI & Sync**.

---

## 7. Updating OmniBrowser

Until auto-update is enabled:

1. Check the project’s release page for new builds.
2. Download the latest installer/AppImage.
3. Install over the existing version (Windows/macOS) or replace your AppImage (Linux).

> Future builds will add delta updates and background download notifications.

---

## 8. Troubleshooting

| Symptom | Resolution |
|---------|------------|
| Installer blocked by antivirus | Temporarily whitelist `OmniBrowser-0.2.0-beta-win.exe`. Provide the published SHA-256 hash once installers are signed. |
| App won’t start (Windows) | Launch from PowerShell with `.\OmniBrowser.exe --verbose` and check `%APPDATA%\OmniBrowser\logs\omnibrowser.log`. |
| App won’t start (macOS) | Run `xattr -dr com.apple.quarantine /Applications/OmniBrowser.app`. |
| Missing `libfuse2` (Linux) | Install `sudo apt install libfuse2`. |
| Consent prompt stuck | Delete `%APPDATA%\OmniBrowser\consent-ledger.json` (Windows) or `~/Library/Application Support/OmniBrowser/consent-ledger.json` (macOS). |

Need more help? Open an issue or reach the beta community channel (Discord/GitHub Discussions TBD).

---

## 9. Next Steps

Once installation is complete, continue with:

- [Consent Ledger Tour](consent-ledger-tour.md) — learn how OmniBrowser handles consent-by-design.
- [User Guide](USER_GUIDE.md) — explore privacy controls, research mode, and agent workflows.
- [Release Notes](../docs/releases/v0.2.0-beta.md) — understand what’s new in the beta.

_Screenshots and signed installer hashes will be added once the packaging pipeline is finalized._

