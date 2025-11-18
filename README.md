# OmniBrowser

**A privacy-first, agentic research browser with Arc-level UX**

Electron + React + TypeScript + Vite multi-mode desktop browser with:
- 🛡️ **Brave + Tor + VPN** unified privacy stack 🧪 *Experimental / in progress*
- 🤖 **Unified AI Engine** ✅ *Complete* - Multi-provider (OpenAI, Anthropic, Ollama), streaming, caching, telemetry
- 📚 **Knowledge graph** foundation 🧪 *Experimental / in progress*
- 🧩 **Plugin runtime** ready 🧪 *Experimental / in progress*
- ⚡ **Performance-first** with tab hibernation 🧪 *Experimental / in progress*
- 🔬 **Research Mode** ✅ *Complete* - File upload, AI analysis, citations
- 💹 **Trade Mode** ✅ *Complete* - AI signals, position sizing, risk management
- 🎮 **Game Mode** ✅ *Complete* - AI recommendations, save states, enhanced search

**Status**: 🟢 **Beta Ready (v0.1.0-alpha)** - Core features complete, ready for testing

[![CI](https://github.com/nrbns/Omnibrowser/workflows/CI/badge.svg)](https://github.com/nrbns/Omnibrowser/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Note**: Core browser foundation, unified AI engine, and mode enhancements (Research, Trade, Game) are complete. Production readiness: 90/100. See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for detailed status and [CHANGELOG.md](./CHANGELOG.md) for recent updates.
> 
> **Issues & Roadmap**: See [GitHub Issues](https://github.com/nrbns/Omnibrowser/issues) for current work and feature requests.

## Quick Start

```bash
npm install
npm run dev
```

## Key Features

### 🔬 Research Mode
- Upload documents (PDF, DOCX, TXT, MD) for AI analysis
- Real-time streaming AI responses with citations
- Knowledge graph visualization
- Multi-source aggregation

### 💹 Trade Mode
- AI-powered trading signals (auto-generates every 30s)
- Position sizing helper with risk management
- Real-time market data and charts
- Portfolio risk metrics

### 🎮 Game Mode
- AI-powered game recommendations
- Enhanced semantic search
- Save/load game states
- Offline-capable games

### 🤖 Unified AI Engine
- Multi-provider support (OpenAI, Anthropic, Ollama)
- Real-time streaming responses
- Cost-aware model selection
- Memory context injection
- Response caching for performance

## Documentation

- [docs/QUICKSTART.md](./docs/QUICKSTART.md) - **Quick Start Guide** (start here!)
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Current features and status
- [docs/BETA_RELEASE_CHECKLIST.md](./docs/BETA_RELEASE_CHECKLIST.md) - Beta release readiness checklist
- [docs/SPRINT_SUMMARY.md](./docs/SPRINT_SUMMARY.md) - Sprint 1-3 completion summary
- [docs/TESTING_CHECKLIST.md](./docs/TESTING_CHECKLIST.md) - Comprehensive testing guide
- [CHANGELOG.md](./CHANGELOG.md) - Release notes and changelog
- [PROJECT_CHECKLIST.md](./PROJECT_CHECKLIST.md) - 90-day build plan checklist
- [ISSUES.md](./ISSUES.md) - Issue tracking and roadmap
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Architecture documentation
- [SECURITY.md](./SECURITY.md) - Security documentation

## Prerequisites
- Node 20+
- npm/pnpm/yarn

## Development
```bash
npm install
npm run dev
```
Vite runs on 5173; Electron loads the renderer.

## Build
```bash
npm run build
```
Outputs platform installers via electron-builder.

## Testing

Playwright-based Electron smoke tests cover the tab strip and critical UI ergonomics. Run them with:

```bash
npm run test:e2e
```

The first run may prompt Playwright to download browser dependencies. In CI the suite runs headlessly and fails the pipeline if any smoke assertion regresses.

## Safety
- Video download requires explicit consent in Settings.
- Threat Analysis is informational only.
