# GitHub Project Board Setup

This document provides templates for creating the OmniBrowser GitHub Project board and issues.

## Project Board Structure

Create a GitHub Project board with these columns:
- **Backlog** - Planned but not started
- **In Progress** - Currently being worked on
- **In Review** - PR open, awaiting review
- **Done** - Completed and merged

## Issue Templates

### Immediate Tasks (Week 0-1)

#### I. Release Pipeline Verification
**Title**: Verify and test release pipeline for v0.1.0-alpha

**Labels**: `priority:high`, `infrastructure`, `release`

**Description**:
```markdown
## Goal
Verify the release workflow (`.github/workflows/release.yml`) works end-to-end and can produce installers for all platforms.

## Acceptance Criteria
- [ ] Manual test: Create tag `v0.1.0-alpha` and verify workflow runs
- [ ] Verify Windows installer (NSIS) is created and downloadable
- [ ] Verify macOS installer (DMG) is created and downloadable  
- [ ] Verify Linux installer (AppImage) is created and downloadable
- [ ] Verify SHA256 checksums are generated and included
- [ ] Verify CHANGELOG.md extraction works for release notes
- [ ] Test manual workflow_dispatch trigger

## Tasks
- [ ] Review release.yml for any missing steps
- [ ] Test on a test tag first
- [ ] Document release process in CONTRIBUTING.md
- [ ] Add release checklist template

## Related
- Release workflow: `.github/workflows/release.yml`
- Package version: `package.json`
```

---

#### II. SessionStore Crash-Safety Enhancement
**Title**: Enhance SessionStore with fsync for crash-safe persistence

**Labels**: `priority:high`, `bug`, `stability`

**Description**:
```markdown
## Goal
Ensure session restore works reliably even if app crashes mid-write.

## Current Status
Session persistence exists in `electron/services/session-persistence.ts` with atomic writes, but should verify fsync is working correctly.

## Acceptance Criteria
- [ ] Kill app mid-session → restore windows/tabs/bounds in <1s p95
- [ ] Verify fsync is called after each write
- [ ] Test with rapid tab creation/deletion
- [ ] Test with app force-quit during save
- [ ] Playwright test: simulate kill & restore

## Tasks
- [ ] Review `session-persistence.ts` fsync implementation
- [ ] Add explicit fsync after temp file write
- [ ] Add Playwright test for crash recovery
- [ ] Verify restore prompt appears correctly
- [ ] Test edge cases (corrupted session file, missing file)

## Related Files
- `electron/services/session-persistence.ts`
- `tests/e2e/session-restore.spec.ts`
```

---

#### III. Download Manager Verification
**Title**: Verify download manager pause/resume and SHA-256

**Labels**: `priority:high`, `feature`, `testing`

**Description**:
```markdown
## Goal
Verify the download manager works correctly with pause/resume and SHA-256 verification.

## Acceptance Criteria
- [ ] Pause/resume functional on large files (>100MB)
- [ ] Worker hashing does not block UI
- [ ] SHA-256 displayed in UI after verification
- [ ] Show-in-folder opens correct location
- [ ] Playwright test: pause/resume, verify SHA256 present

## Tasks
- [ ] Review `electron/services/downloads-enhanced.ts`
- [ ] Test pause/resume on slow connection
- [ ] Verify worker thread for checksum calculation
- [ ] Test with various file types
- [ ] Add Playwright test coverage

## Related Files
- `electron/services/downloads-enhanced.ts`
- `electron/services/downloads/checksum.ts`
- `tests/e2e/downloads.spec.ts`
```

---

#### IV. TabStrip Correctness & Accessibility
**Title**: Verify TabStrip fixes (stable keys, middle-click, keyboard nav)

**Labels**: `priority:high`, `bug`, `accessibility`

**Description**:
```markdown
## Goal
Ensure TabStrip has no mis-activation bugs and supports all expected interactions.

## Acceptance Criteria
- [ ] No mis-activation bugs (tabs don't switch unexpectedly)
- [ ] Middle-click closes tab correctly
- [ ] Arrow keys navigate tabs
- [ ] Home/End keys jump to first/last tab
- [ ] Close button doesn't trigger tab activation
- [ ] Playwright test for tab behaviors

## Tasks
- [ ] Review `src/components/layout/TabStrip.tsx`
- [ ] Test all keyboard shortcuts
- [ ] Test middle-click on various tab positions
- [ ] Verify `e.stopPropagation()` on close button
- [ ] Add Playwright test coverage

## Related Files
- `src/components/layout/TabStrip.tsx`
- `tests/e2e/core-flows.spec.ts`
```

---

#### V. Portal + Z-Index Contract
**Title**: Ensure portal-root and z-index contract prevents UI overlap

**Labels**: `priority:medium`, `bug`, `ui`

**Description**:
```markdown
## Goal
Ensure all modals/popovers mount to portal-root and z-index tokens prevent overlap.

## Acceptance Criteria
- [ ] `#portal-root` exists in index.html
- [ ] All modals/popovers mount to portal
- [ ] No UI element appears behind webview
- [ ] Z-index tokens defined in tailwind config
- [ ] Manual test on all pages

## Tasks
- [ ] Verify `#portal-root` in `index.html`
- [ ] Audit all modal/popover components
- [ ] Define z-index scale in `tailwind.config.ts`
- [ ] Test with multiple overlays open
- [ ] Document z-index usage guidelines

## Related Files
- `index.html`
- `src/components/common/Portal.tsx`
- `tailwind.config.ts`
```

---

#### VI. Dark-Mode FOUC Fix
**Title**: Fix flash of unstyled content (white flash) on load

**Labels**: `priority:medium`, `bug`, `ux`

**Description**:
```markdown
## Goal
Eliminate white flash on page load by pre-initializing theme.

## Acceptance Criteria
- [ ] No white flash on load (manual check)
- [ ] Theme applied before React renders
- [ ] Works with localStorage + matchMedia fallback

## Tasks
- [ ] Add inline theme pre-init script in `index.html`
- [ ] Use localStorage to read saved theme
- [ ] Fallback to matchMedia for system preference
- [ ] Test on fresh install
- [ ] Test with theme switching

## Related Files
- `index.html`
- `src/components/TopNav/ThemeSwitcher.tsx`
```

---

#### VII. Telemetry (Privacy-Safe, Opt-In)
**Title**: Implement minimal opt-in telemetry for early analytics

**Labels**: `priority:medium`, `feature`, `privacy`

**Description**:
```markdown
## Goal
Add minimal telemetry (install, crash, perf) with opt-in consent.

## Acceptance Criteria
- [ ] Telemetry default OFF
- [ ] User can opt-in from onboarding
- [ ] Capture: install event, crash reports, perf metrics
- [ ] Privacy-safe: no PII, anonymized
- [ ] Store on server for early analytics

## Tasks
- [ ] Design telemetry schema
- [ ] Add opt-in toggle to onboarding
- [ ] Implement telemetry service
- [ ] Add privacy policy link
- [ ] Test opt-in/opt-out flow

## Related Files
- `src/components/Onboarding/OnboardingTour.tsx`
- `electron/services/telemetry.ts` (new)
```

---

### Medium-Term Items (Week 2-12)

#### A. Local-Lite LLM + RAG Stack
**Title**: Add local inference support (GGUF/ggml) with RAG service

**Labels**: `priority:medium`, `feature`, `ai`, `research`

**Description**:
```markdown
## Goal
Enable on-device LLM inference (7B models) via WebGPU or native worker, with RAG vector store.

## Acceptance Criteria
- [ ] Summarization latency < 2s on supported hardware
- [ ] Fallback to cloud seamlessly
- [ ] Vector store (Faiss/HNSW) on local disk
- [ ] Retriever API integrated with Redix

## Tasks
- [ ] Research GGUF/ggml integration options
- [ ] Implement WebGPU or native worker bindings
- [ ] Build vector store service
- [ ] Integrate with Redix summarizer
- [ ] Add fallback logic

## Related
- `apps/api/ollama_client.py`
- Research mode summarization
```

---

#### B. Experiment & Reproducibility Infra
**Title**: MLflow/W&B-style tracking for reproducible experiments

**Labels**: `priority:low`, `infrastructure`, `research`

**Description**:
```markdown
## Goal
Enable reproducible research experiments with config + seed + commit hash tracking.

## Acceptance Criteria
- [ ] Any experiment reproduces top-line within 3% error given same seed/commit
- [ ] Dockerized training/eval images
- [ ] Jupyter-ready researchers

## Tasks
- [ ] Design experiment manifest schema
- [ ] Implement tracking service
- [ ] Create Docker images
- [ ] Document experiment workflow
```

---

#### C. Evaluation Harness for Research Mode
**Title**: Automated judge pipeline for citation/accuracy evaluation

**Labels**: `priority:medium`, `feature`, `research`, `testing`

**Description**:
```markdown
## Goal
Automated evaluation of citation coverage, precision@k, hallucination rate, evidence anchor accuracy.

## Acceptance Criteria
- [ ] Ground-truth dataset (news & Wikipedia subsets)
- [ ] Metrics: citation coverage, precision@k, hallucination rate, anchor accuracy
- [ ] Evaluate every PR that changes research code
- [ ] Require no increase in hallucination metric

## Tasks
- [ ] Create ground-truth dataset
- [ ] Implement automated judge
- [ ] Add CI integration
- [ ] Create evaluation dashboard
```

---

## Creating the Project Board

1. Go to GitHub repository → **Projects** tab
2. Click **New project** → **Board**
3. Name it: **OmniBrowser Roadmap**
4. Add columns: Backlog, In Progress, In Review, Done
5. Create issues using the templates above
6. Link issues to the project board

## Issue Labels

Create these labels in GitHub:
- `priority:high`, `priority:medium`, `priority:low`
- `infrastructure`, `feature`, `bug`, `testing`, `research`, `ai`, `privacy`, `ux`, `accessibility`, `stability`, `release`

## Milestones

Create milestones:
- **Week 0-1: Immediate Tasks** (all high-priority items)
- **Week 2-4: Core Features**
- **Week 4-8: Research Infrastructure**
- **Week 8-12: Advanced Features**

