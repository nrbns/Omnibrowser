# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the versioning follows a `0.y.z` pre-release cadence while OmniBrowser is in beta.

## [Unreleased]

### Added
- Research Mode citation verifier with real-time coverage checking
- Enhanced Playwright smoke suite for core flows (session, downloads, tabs, research)
- GitHub Project board setup with issue templates
- Portal + z-index contract to prevent UI overlap
- Dark-mode FOUC fix with inline theme pre-init
- Privacy-safe telemetry opt-in (opt-in only, no PII)
- Release pipeline verification guide and test script

### Changed
- Restored project status tracking via `PROJECT_STATUS.md`, including phase health, blockers, and upcoming milestones.
- Reworked top navigation with grouped menus (`View`, `Workspace`, `Tools`) for clearer action discoverability.
- Updated OmniDesk empty-state with smaller quick-action tiles, descriptive copy, and left-aligned hero messaging.
- Centralized tab creation IPC helper to ensure typed responses and cleaner error handling.

### Fixed
- TypeScript build errors in telemetry service
- Portal z-index conflicts with webview content
- White flash on page load (FOUC)

### Known Issues
- Several Phase A checklist items remain open (CI automation, installer signing, accessibility audit, split-view UI).

## [0.1.0-alpha] – 2024-??-??

> _Historical entries prior to this changelog were not tracked. Earlier milestones included the initial Electron shell, research mode prototype, and session persistence groundwork._

---

For older history, refer to commit logs prior to this changelog introduction.

