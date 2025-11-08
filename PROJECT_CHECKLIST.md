# OmniBrowser 90-Day Build Plan - Project Checklist

**Target:** World-class browser competitor (Brave privacy/perf, Perplexity AI research, AI-first browsers)
**Timeline:** 90 days (12 weeks) across 4 phases
**Status:** 🟡 In Progress

---

## Quality Bars & KPIs (Success Metrics)

### Performance
- [ ] Cold start < 1000ms (mid-range 2019 hardware)
- [ ] Warm start < 500ms
- [ ] Tab switch < 16ms
- [ ] Scroll 60fps on heavy news pages
- [ ] Research Mode answer with 6 sources < 4s median (cache hot)
- [ ] Research Mode answer with 6 sources < 8s p95 (cold)

### Accuracy / Trust
- [ ] 100% of non-trivial sentences in AI answers have at least one citation
- [ ] < 1% verifiable hallucination rate in audit checks (internal rubric)
- [ ] Evidence overlay hit-rate > 95% (DOM anchors still valid 24h later)

### UX
- [ ] 0 crash loops in packaged builds across 10k sessions (internal soak)
- [ ] Keyboard-complete navigation
- [ ] Contrast >= 4.5:1 (WCAG AA)
- [ ] Screen-reader labels for nav/omnibar/tabs

### Privacy
- [ ] 0 background requests without consent
- [ ] Clear per-site data boundaries (containers)
- [ ] No 3P analytics by default; opt-in telemetry only

---

## Phase 1: Rock-Solid Browser Core (Weeks 1-3)

### Tabs & Sessions
- [x] Finalize tabstrip bugs (stable keys, scroll-into-view, middle-click close)
- [x] Implement keyboard navigation (Left/Right/Home/End)
- [x] Atomic session store (JSONL or sqlite)
- [x] Crash-safe restore (persist every 2s)
- [x] Window resume (restore window positions/sizes)
- [x] Partitioned profiles/containers per tab
- [x] Session bundles (save/restore research sessions with tabs + notes + embeddings)

### Downloads
- [x] Full download manager UI
- [x] `will-download` handler with progress tracking
- [x] Pause/resume functionality
- [x] Per-site default folder settings
- [x] Safe-file checks (SHA256 verification)
- [x] Virus scan hook (local/optional cloud)
- [x] Quarantine tagging

### Privacy
- [x] Ship default blocklists (EasyList/EasyPrivacy + uBO annoyances)
- [x] Per-site permissions UI (toggle JS, cookies, media, etc.)
- [x] Containers UI (partition IDs, create/delete/switch)
- [x] Fingerprinting defense mode
- [x] First-party ephemeral containers
- [x] Zero 3rd-party calls without consent enforcement

### Omnibar
- [x] Quick actions (`/ai`, `/t`, `/calc`, `/yt`, `/g`)
- [x] Instant suggestions (local cache + network race)
- [x] Site shortcuts
- [x] Offline search history fallback
- [x] Multi-provider search (Google, DuckDuckGo, etc.)

### Performance Pass
- [x] Cold start budget check (< 1000ms target)
- [x] Lazy hydration for heavy components
- [x] Code-split big views (Research Mode, Document Review, Settings)
- [x] Avoid layout thrash (measure and fix)
- [x] Preload hot modules
- [x] Defer non-critical resources

---

## Phase 2: Research Mode v1 (Weeks 4-6) - THE HEADLINER

### Retrieval Engine
- [x] Parallel fetchers (news, docs, academic when available)
- [x] Multi-source retrieval (5-12 diverse sources)
- [x] Source voting mechanism
- [x] Crawl/browse orchestration
- [x] Cache hot/cold optimization

### Summarizer
- [x] Model-agnostic architecture (local/remote)
- [x] Citations with inline footnotes
- [x] Sidebar citation list
- [x] Time stamps for all sources
- [x] Confidence bar visualization

### Verifier
- [x] Second pass to check every sentence has a citation
- [x] Flag ungrounded text (hallucination watchdog)
- [x] Claim density vs citations ratio
- [x] Verifiable hallucination detection (< 1% target)

### Controls UI
- [x] Recency vs authority slider
- [x] Diversity toggle (mainstream vs niche)
- [x] "Include counterpoints" checkbox
- [x] Region filter
- [x] Legal/medical safety guard mode
- [x] Bias controls (sliders for recency, authority, region sensitivity)

### Evidence Overlay
- [x] Click sentence → highlight exact source span on page (DOM anchors)
- [x] Auto-archive snapshot for permanence
- [x] Evidence overlay hit-rate > 95% (validity check)

### Advanced Features
- [x] Contradictions radar (detect when sources disagree)
- [x] "What experts disagree on" display box
- [x] Task chains UI ("Compare X vs Y", "Summarize then verify")
- [x] Editable task chains

---

## Phase 3: Document Review v1 + Polishing (Weeks 7-9)

### Document Ingestion
- [x] PDF extraction (text + tables)
- [x] DOC/DOCX extraction
- [x] Web URL ingestion
- [x] Section TOC generation
- [x] Entity extraction
- [x] Timeline extraction

### Cross-Check Pipeline
- [x] Find claims in documents
- [x] Fetch 3-8 corroborating sources per claim
- [x] Mark claims green/amber/red (verified/unverified/disputed)
- [x] Table extraction and verification
- [x] Assumptions detected highlighting

### Exports
- [x] Markdown export with footnotes
- [x] HTML export with citations
- [x] Citation style toggle (APA, MLA, Chicago, etc.)
- [x] Google Doc export (with footnotes)
- [x] Audit trail (every claim linked to exact page/line)

- [x] Tab roles/labels (ARIA)
- [x] Keyboard coverage (full navigation)
- [x] Screen-reader support
- [x] Base i18n pipeline
- [x] Contrast checks (>= 4.5:1)

### Stability & Testing
- [ ] 500+ manual regression checks
- [ ] Playwright Electron smoke tests
- [ ] Unit tests on tab/session reducers
- [ ] Integration tests for Research Mode
- [ ] Integration tests for Document Review

---

## Phase 4: Pre-Launch Hardening & Store Release (Weeks 10-12)

### Auto-Update & Distribution
- [ ] Auto-update mechanism
- [ ] Code signing (Windows/macOS/Linux)
- [ ] Release channels (Stable/Beta)
- [ ] Installer packages (Windows .exe, macOS .dmg, Linux .AppImage/.deb/.rpm)
- [ ] Update server infrastructure

### Settings & Configuration
- [ ] Container profiles UI
- [ ] Privacy levels (strict/moderate/relaxed)
- [ ] Default AI provider selection
- [ ] Telemetry toggle (opt-in only)
- [ ] Per-site permissions management
- [ ] Export/import settings

### First-Run Experience
- [ ] Quick tutorial (onboarding flow)
- [ ] Privacy defaults configuration
- [ ] Choose AI providers
- [ ] Welcome screen with value proposition

### Documentation
- [ ] Transparent privacy page
- [ ] "How OmniBrowser cites & verifies" explainer
- [ ] User guide (Research Mode, Document Review, Containers)
- [ ] Developer docs (for extensions/commands)
- [ ] Privacy policy (GDPR/CCPA compliant)

### Diagnostics & Error Handling
- [ ] "Open logs folder" button
- [ ] In-app error boundary with recover/restore
- [ ] One-click "copy diagnostics"
- [ ] Rolling logs (rotate on size/age)
- [ ] Source maps in production (done ✅)
- [ ] Opt-in diagnostics telemetry

---

## Differentiation Pillars (Ongoing)

### Pillar 1: Research Mode that Earns Trust
- [x] Multi-engine retrieval with source voting
- [ ] Live-page evidence with DOM anchoring
- [ ] Contradictions radar
- [ ] Bias controls (sliders)
- [ ] Task chains UI

### Pillar 2: Document Review Mode
- [ ] PDF/DOC/Web ingestion
- [ ] Fact-check highlights
- [ ] Timeline & entity graph
- [ ] Assumptions detected
- [ ] Audit trail with exact page/line links

### Pillar 3: Privacy & Identity "Containers++"
- [ ] Per-tab containers (work/personal/anonymized)
- [ ] Isolated storage & fingerprint per container
- [ ] Per-site permissions pinned to container
- [ ] Stealth fetch for AI (clean container for research)

### Pillar 4: Power-User Velocity
- [ ] Command Palette : tabs/apps/actions/search
- [ ] Extensible commands system
- [ ] Session bundles (save/restore)
- [ ] Auto-actions (watchers, alerts)
- [ ] Integrations (Notion/Obsidian export, GitHub issues)

### Pillar 5: Trust + Compliance
- [ ] Citations by default (not optional)
- [ ] Hallucination watchdog
- [ ] No hidden calls (endpoint status indicator)
- [ ] Enterprise mode (policy-locked, audit logs)
- [ ] On-prem LLM option

---

## Must-Have (Pre-Launch)

- [x] Site isolation groundwork
- [x] Hardened webPreferences
- [x] Navigation guards
- [x] Pop-up blocking
- [x] IPC typed layer
- [x] Tab lifecycle fixes
- [ ] Session restore & bundles
- [ ] Download manager + safe-file checks
- [ ] Per-tab containers & permission UI
- [ ] Research Mode v1 (multi-source, citations, verifier, controls)
- [ ] Document Review v1 (facts, tables, exports)
- [ ] Command Palette  with core actions
- [ ] Auto-update + signed releases
- [ ] Playwright smoke tests + unit tests
- [ ] "Open logs folder" + in-app error boundary

---

## Fast-Follows (First 2-3 Months)

### Watchers & Alerts
- [ ] Page change detection
- [ ] Daily/weekly summaries
- [ ] Price/news monitoring
- [ ] Alert system

### Notes & Annotations
- [ ] Highlight text on page
- [ ] Side notes
- [ ] Export to Markdown
- [ ] Notion/Obsidian export

### Profiles
- [ ] Work/personal profiles
- [ ] Quick switch UI
- [ ] Policy locks per profile

### Local LLM
- [ ] GGUF support for offline summarize
- [ ] Fall back to cloud with consent
- [ ] Model selection UI

### Reading Mode
- [ ] Clean article view
- [ ] Cite-preserving summarize
- [ ] Export clean view

---

## Moat Builders (6 Months)

### Contradiction Engine
- [ ] Disagreement map across sources
- [ ] Expert opinion clustering
- [ ] Confidence scoring

### Expert Tool Modules
- [ ] Finance (SEC/EDGAR integration)
- [ ] Science (PubMed/ArXiv integration)
- [ ] Law (statutes/cases integration)
- [ ] Domain-specific extractors
- [ ] Domain-specific citation styles

### Marketplace
- [ ] Command marketplace (curated only)
- [ ] Security review process
- [ ] Command installation UI

### Team/Enterprise
- [ ] Shared research sessions
- [ ] Audit logs
- [ ] Policy provisioning
- [ ] Admin dashboard

---

## Technical Debt & Infrastructure

### Build & CI/CD
- [ ] Automated builds (GitHub Actions)
- [ ] Automated tests (unit, integration, e2e)
- [ ] Automated releases (staging/production)
- [ ] Code signing automation
- [ ] Update server deployment

### Monitoring & Observability
- [ ] Crash reporting (opt-in)
- [ ] Performance monitoring
- [ ] Error tracking
- [ ] User analytics (opt-in, privacy-preserving)

### Security
- [ ] Security audit
- [ ] Penetration testing
- [ ] Dependency scanning
- [ ] Code signing certificates
- [ ] CSP hardening

---

## Notes

- **Last Updated:** 2025-11-08
- **Current Phase:** Phase 4 (Weeks 10-12)
- **Next Milestone:** Auto-update & store release readiness
- **Blockers:** None currently

---

## Progress Tracking

### Phase 1: 31/31 tasks completed (100%)
### Phase 2: 21/21 tasks completed (100%)
### Phase 3: 12/15 tasks completed (80%)
### Phase 4: 0/18 tasks completed (0%)
### Must-Have: 10/16 tasks completed (63%)
### Fast-Follows: 0/20 tasks completed (0%)
### Moat Builders: 0/10 tasks completed (0%)

**Overall Progress: 82/125 tasks completed (66%)**

---

*Use this checklist to track progress. Check off items as they're completed. Update the progress tracking section regularly.*

