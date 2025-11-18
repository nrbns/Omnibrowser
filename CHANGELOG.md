# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the versioning follows a `0.y.z` pre-release cadence while OmniBrowser is in beta.

## [Unreleased]

### Added - Sprint 3: Mode Enhancements (Jan 2026)
- **Research Mode:**
  - File/document upload support (PDF, DOCX, TXT, MD) with client-side parsing
  - AI-powered document extraction and integration into research context
  - Auto-graph generation from AI responses with uploaded documents as high-relevance sources
  - Document list UI with remove functionality
- **Trade Mode:**
  - AI-powered trading signals with real-time analysis (auto-generates every 30s)
  - Structured trading signals: buy/sell/hold with entry, stop loss, take profit, confidence
  - AI position sizing helper with portfolio risk limits (2% default, 10% max per position)
  - Trading-specific system prompts for better AI responses
  - Signal application that auto-fills order entry forms
- **Game Mode:**
  - AI-powered game recommendations based on favorites, recent plays, and categories
  - Enhanced semantic search with AI understanding of game descriptions and tags
  - Save/load game state with localStorage persistence and visual indicators
  - Game state management UI (save, load, clear buttons)
- **Backend:**
  - Mode-specific system prompts (trade, games) for context-aware AI responses
  - Enhanced context builder for document processing

### Added - Sprint 2: Unified AI Engine (Jan 2026)
- **SSE Streaming:**
  - Real-time token-by-token streaming from `/api/ai/task` endpoint
  - Abort support via `AbortController` for cancelling requests
  - Structured event system (token, done, error events)
- **Multi-Provider Support:**
  - OpenAI integration with GPT-4 models
  - Anthropic (Claude) integration with automatic fallback
  - Ollama (local) integration for offline AI
  - Dynamic provider availability checking and routing
- **Policy Engine:**
  - Cost-based model selection (LOW/MEDIUM/HIGH tiers)
  - Task-specific policies (search=low cost, agent=medium, etc.)
  - Token budget enforcement with safety limits
  - Automatic fallback chains when primary provider unavailable
- **Rate Limiting:**
  - Per-task rate limits (requests per minute/hour/day)
  - Cost-based limits (hourly and daily caps)
  - Client identification (user ID or IP fallback)
  - Automatic cleanup of old entries
- **Telemetry & Metrics:**
  - Database persistence (SQLite/Postgres) for AI task metrics
  - JSONL logging for structured telemetry
  - `/api/ai/metrics` dashboard endpoints (summary, timeline, top errors)
  - Cost tracking per request (provider, model, tokens, latency, USD)
- **Structured Citations:**
  - Normalized citation format with metadata (index, title, URL, snippet, source)
  - Citations included in SSE `done` events
  - Consistent citation structure across all AI responses
- **Memory Context Injection:**
  - Automatic SuperMemory integration for personalized responses
  - Semantic search for relevant memories (top 5, min similarity 0.6)
  - Active tab context inclusion
  - Recent agent runs context for agent tasks
- **Error Handling:**
  - Exponential backoff retries for retryable errors
  - User-friendly error messages
  - Smart fallback to alternative providers/models
  - Detailed error logging with context
- **Performance:**
  - Connection pooling (HTTP/2) for reduced latency
  - Response caching (LRU cache, per-task TTL: 30min search, 2hr chat)
  - Cache management endpoints (stats, clear)

### Added - Sprint 1: Core Browser Foundation (Jan 2026)
- **Tab Lifecycle:**
  - Mode-aware tabs (each tab tagged with appMode: browse/research/trade/game)
  - Keyboard shortcuts: `Ctrl/Cmd + Tab`, `Ctrl/Cmd + Shift + Tab`, `Ctrl/Cmd + 1-9`
  - Recently closed tabs stack with `Ctrl/Cmd + Shift + T` to reopen
  - Tab reordering via drag-and-drop
  - Auto-create new tab when last tab in mode is closed
  - Tab persistence across sessions
- **Address/Search Bar:**
  - Smart suggestions: history, open tabs, commands (`/g`, `/d`, `/r`, `/t`), SuperMemory
  - Inline autocomplete with "ghost text" and Tab-to-complete
  - Keyboard navigation (↑/↓ to cycle, Enter to apply, Esc to clear)
  - Unified suggestion groups with badges and highlighting
- **Settings Panel:**
  - General settings: startup behavior, default search engine, home page
  - Privacy settings: local-only mode, clear browsing data, session restore
  - Appearance settings: theme toggle (light/dark), compact mode
  - Keyboard shortcuts reference
  - Account settings section
  - All settings persist to localStorage
- **Session & Cache:**
  - Session snapshots with automatic save on tab changes
  - Restore banner after app restart
  - "Clear browsing data" flow (session, history, recently closed)
  - "Clear on exit" preference
  - Session persistence with BrowserView recreation
- **Responsive Layout:**
  - Desktop (≥1280px): inline panels, full-width tab strip
  - Tablet (768-1279px): drawer-based panels with backdrop overlays
  - Mobile (<768px): collapsed drawers, scrollable tab strip
  - Smooth layout transitions on window resize
- **Extension Placeholder:**
  - Extension manifest schema (`extensions/manifest.schema.json`)
  - Renderer API stub (`src/extensions/platform.ts`)
  - Global `window.regenExtensions` interface

### Added - Testing & QA (Jan 2026)
- Comprehensive UAT checklist (`docs/TESTING_CHECKLIST.md`) covering all Sprint 1, 2, & 3 features
- E2E test coverage for Research file upload, Trade AI signals, Game recommendations & save states
- Integration test scenarios for cross-feature workflows
- 4 end-to-end UAT scenarios for real-world user workflows

### Added - Performance Optimization (Jan 2026)
- **Code Splitting:** Lazy loading for all mode panels using React.lazy() and Suspense
- **Bundle Optimization:** Home bundle reduced from 1.2MB → 32KB (97% reduction)
- **Manual Chunks:** Vendor libraries split into separate chunks (React, charts, PDF, AI, memory, etc.)
- **Mode Isolation:** Each mode (Research, Trade, Games, etc.) loads independently on demand

### Changed
- Restored project status tracking via `PROJECT_STATUS.md`, including phase health, blockers, and upcoming milestones.
- Reworked top navigation with grouped menus (`View`, `Workspace`, `Tools`) for clearer action discoverability.
- Updated OmniDesk empty-state with smaller quick-action tiles, descriptive copy, and left-aligned hero messaging.
- Centralized tab creation IPC helper to ensure typed responses and cleaner error handling.
- **SearchBar:** Migrated from legacy `fetchSearchLLM` to unified `aiEngine.runTask` with streaming support
- **Agent Console:** Migrated from IPC streaming bridge to unified `aiEngine.runTask` with abort support
- **Research Mode:** Integrated unified AI engine with memory context and structured citations
- **Trade Mode:** Replaced Redix workflow with unified AI engine for trading signals
- **Game Mode:** Added AI-powered recommendations and enhanced search
- **Home Route:** Implemented code splitting with lazy loading for all mode panels (97% bundle size reduction)
- **Vite Config:** Added manual chunks configuration for optimal vendor library splitting

### Fixed
- TypeScript build errors in telemetry service
- Portal z-index conflicts with webview content
- White flash on page load (FOUC)
- Research mode `capitalize` function reference error
- Tab strip suggestion dropdown keyboard navigation
- Session restore with mode-aware tabs
- Layout issues: floating card effect, double scrollbars, viewport sizing

### Known Issues
- E2E tests may skip in CI environments if Electron doesn't launch properly
- Game save states depend on iframe postMessage API (may not work with all embedded games)
- File upload parsing may be slow for very large documents (>5MB)

## [0.1.0-alpha] – 2024-??-??

> _Historical entries prior to this changelog were not tracked. Earlier milestones included the initial Electron shell, research mode prototype, and session persistence groundwork._

---

For older history, refer to commit logs prior to this changelog introduction.

