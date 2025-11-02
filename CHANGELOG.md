# Changelog

All notable changes to OmniBrowser will be documented in this file.

## [Unreleased]

### Added
- **Private/Ghost Mode**: In-memory partitions, content protection, automatic cleanup
- **Burn Tab**: Instant data clearing per tab
- **Panic Wipe**: Emergency data clearing for all tabs/sessions
- **Forensic Cleanse**: Deep cache clearing including disk cache
- **Enhanced Downloads**: Consent-gated downloads with SHA-256 checksums
- **Private Downloads**: Downloads from private tabs route to temp directory
- **CI/CD Workflows**: GitHub Actions for lint, typecheck, build, and release
- **E2E Tests**: Playwright tests for private mode, downloads, shields
- **Project Documentation**: CONTRIBUTING.md, SECURITY.md, PRIVACY.md

### Enhanced
- **Browser Navigation**: Back/forward/refresh with keyboard shortcuts
- **Fullscreen Support**: Proper BrowserView resizing in fullscreen mode
- **IPC Events**: Real-time event bus for tabs, shields, downloads, agent, network

### Changed
- Exported `getTabs` from `tabs.ts` for use in burn/panic functions
- Added `checksum` field to Download type for file verification

### Fixed
- TypeScript errors in private-guards.ts, burn.ts, downloads-enhanced.ts
- Fullscreen BrowserView bounds calculation
- Navigation state updates on tab activation

## [0.1.0] - 2025-01-XX

### Added
- Initial release
- Agentic browser with multi-mode support
- Privacy stack (Tor, Shields, VPN, DoH)
- Research mode with content extraction
- Multi-session support
- Video call optimization

