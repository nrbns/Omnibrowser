# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the versioning follows a `0.y.z` pre-release cadence while OmniBrowser is in beta.

## [Unreleased]

### Added
- Restored project status tracking via `PROJECT_STATUS.md`, including phase health, blockers, and upcoming milestones.
- Reworked top navigation with grouped menus (`View`, `Workspace`, `Tools`) for clearer action discoverability.
- Updated OmniDesk empty-state with smaller quick-action tiles, descriptive copy, and left-aligned hero messaging.

### Changed
- Centralized tab creation IPC helper to ensure typed responses and cleaner error handling.
- Began reorganizing release hygiene tasks (status doc, release notes, CI gating) for Phase A – Beta Readiness.

### Known Issues
- TypeScript build (`npm run build:types`) currently fails because of legacy type gaps in tabs, downloads, research, and Electron main-process modules. Issue tracked for Phase A.
- Several Phase A checklist items remain open (CI automation, installer signing, accessibility audit, split-view UI).

## [0.1.0-alpha] – 2024-??-??

> _Historical entries prior to this changelog were not tracked. Earlier milestones included the initial Electron shell, research mode prototype, and session persistence groundwork._

---

For older history, refer to commit logs prior to this changelog introduction.

