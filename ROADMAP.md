# OmniBrowser Roadmap - 14-Day Sprint Plan

**Based on System Blueprint v1.0**

---

## Sprint Overview

**Duration**: 14 days (2 weeks)  
**Goal**: Complete MVP feature set + lay foundation for V2

---

## Epic 1: Core Agent Enhancement (Days 1-3)

### Epic Goals
- Expand Agent Core tool registry
- Implement advanced planning
- Add guardrails and safety checks

### Tasks

#### Day 1: Tool Registry Expansion
- [x] **Task 1.1**: Implement PDF parsing tool
  - File: `electron/services/agent/skills/pdf-parser.ts`
  - Integrate `pdf-parse` library
  - Extract text, metadata, pages
  - Priority: High

- [x] **Task 1.2**: Implement YouTube transcript tool
  - File: `electron/services/agent/skills/yt-transcript.ts`
  - Use `yt-dlp` for transcript extraction
  - Priority: Medium

- [x] **Task 1.3**: Implement table extraction tool
  - File: `electron/services/agent/skills/table-extract.ts`
  - Enhance existing `extract-table.ts`
  - Priority: Medium

#### Day 2: Advanced Planning
- [x] **Task 1.4**: Multi-step planning system
  - File: `electron/services/agent/planner.ts`
  - Generate step-by-step plans from user goals
  - Priority: High

- [x] **Task 1.5**: Plan execution with rollback
  - File: `electron/services/agent/executor.ts`
  - Execute plans with error handling
  - Priority: High

#### Day 3: Guardrails
- [x] **Task 1.6**: Prompt firewall
  - File: `electron/services/agent/guardrails.ts`
  - Filter unsafe prompts
  - Priority: High

- [x] **Task 1.7**: Domain allow/deny lists
  - File: `electron/services/agent/policy.ts` (enhance)
  - Per-workspace domain policies
  - Priority: Medium

- [x] **Task 1.8**: Rate limiting
  - File: `electron/services/agent/rate-limiter.ts`
  - Prevent abuse
  - Priority: Medium

---

## Epic 2: Document Review Mode (Days 4-6)

### Epic Goals
- PDF viewer with PDFium
- Side-by-side comments
- AI summarize panel
- Redline support

### Tasks

#### Day 4: PDFium Integration
- [x] **Task 2.1**: PDFium native module setup
  - File: `electron/services/pdf/pdfium-bridge.ts`
  - Install `pdfium-node` or similar
  - Priority: High

- [x] **Task 2.2**: PDF viewer component
  - File: `src/components/DocumentViewer/PDFViewer.tsx`
  - Render PDF pages
  - Priority: High

#### Day 5: Comments System
- [x] **Task 2.3**: Comment storage
  - File: `electron/services/pdf/comments.ts`
  - Store comments per PDF + page + coordinates
  - Priority: Medium

- [x] **Task 2.4**: Comment UI
  - File: `src/components/DocumentViewer/CommentsPanel.tsx`
  - Side-by-side view
  - Priority: Medium

#### Day 6: AI Summarize
- [x] **Task 2.5**: PDF summarization
  - File: `electron/services/pdf/summarizer.ts`
  - Extract text → summarize with citations
  - Priority: High

- [x] **Task 2.6**: Summary panel UI
  - File: `src/components/DocumentViewer/SummaryPanel.tsx`
  - Display AI-generated summary
  - Priority: Medium

---

## Epic 3: Search Pipeline Enhancement (Days 7-9)

### Epic Goals
- Query router (direct answer vs. browse)
- Enhanced indexer
- RAG reranking
- Citation spans

### Tasks

#### Day 7: Query Router
- [x] **Task 3.1**: Query classification
  - File: `electron/services/search/query-router.ts`
  - Decide: direct answer vs. browse vs. search
  - Priority: High

- [x] **Task 3.2**: Direct answer system
  - File: `electron/services/search/direct-answer.ts`
  - LLM-based direct answers for simple queries
  - Priority: Medium

#### Day 8: Enhanced Indexer
- [x] **Task 3.3**: Chunking service
  - File: `electron/services/search/chunker.ts`
  - Split documents into 1–2k token chunks
  - Priority: High

- [x] **Task 3.4**: Embedding pipeline
  - File: `electron/services/search/embedder.ts`
  - Generate embeddings → store in Qdrant
  - Priority: High

#### Day 9: RAG Reranking
- [x] **Task 3.5**: Reranker service
  - File: `electron/services/search/reranker.ts`
  - Use ColBERT/monoT5 or simple keyword-based
  - Priority: Medium

- [x] **Task 3.6**: Citation spans
  - File: `electron/services/search/citations.ts`
  - Attach source spans with hashes + timestamps
  - Priority: High

---

## Epic 4: Downloader & Media (Days 10-12)

### Epic Goals
- yt-dlp sandbox integration
- Audio/video download
- Progress UI enhancement

### Tasks

#### Day 10: yt-dlp Integration
- [x] **Task 4.1**: yt-dlp wrapper
  - File: `electron/services/downloads/ytdlp-wrapper.ts`
  - Sandboxed execution
  - Priority: High

- [x] **Task 4.2**: Format selection
  - File: `electron/services/downloads/format-selector.ts`
  - Choose video/audio quality
  - Priority: Medium

#### Day 11: Download Queue
- [x] **Task 4.3**: Queue management
  - File: `electron/services/downloads/queue.ts`
  - Parallel downloads with limits
  - Priority: High

- [x] **Task 4.4**: Progress tracking
  - File: `electron/services/downloads/progress.ts`
  - Real-time progress updates
  - Priority: Medium

#### Day 12: UI Enhancement
- [x] **Task 4.5**: Download panel update
  - File: `src/components/Panels/DownloadsPanel.tsx` (enhance)
  - Show format, quality, progress
  - Priority: Medium

- [ ] **Task 4.6**: Media player integration
  - File: `src/components/MediaPlayer.tsx`
  - Play downloaded videos/audio
  - Priority: Low

---

## Epic 5: API Server Foundation (Days 13-14)

### Epic Goals
- FastAPI server scaffold
- Auth endpoints
- Workspace/Tab CRUD
- WebSocket support

### Tasks

#### Day 13: FastAPI Scaffold
- [x] **Task 5.1**: FastAPI project setup
  - File: `apps/api/main.py`
  - Basic structure, CORS, middleware
  - Priority: High

- [x] **Task 5.2**: Auth system
  - File: `apps/api/routes/auth.py`
  - Signup, login, OIDC, token refresh
  - Priority: High

#### Day 14: Core Endpoints
- [x] **Task 5.3**: Workspace endpoints
  - File: `apps/api/routes/workspaces.py`
  - CRUD operations
  - Priority: High

- [x] **Task 5.4**: WebSocket events
  - File: `apps/api/routes/events.py`
  - Real-time tab/agent updates
  - Priority: Medium

- [x] **Task 5.5**: Agent endpoints
  - File: `apps/api/routes/agent.py`
  - Plan, run, stream (SSE)
  - Priority: Medium

---

## Sprint Backlog (If Time Permits)

### Low Priority (Can Defer)
- [x] ClamAV integration for file scanning
  - File: `electron/services/threats/clamav-scanner.ts`
  - Integrates with ClamAV daemon or clamscan
  - Priority: Low

- [x] OpenTelemetry observability setup
  - File: `electron/services/observability/telemetry.ts`
  - Distributed tracing and metrics
  - Priority: Low

- [x] Feature flags (Unleash/ConfigCat)
  - File: `electron/services/feature-flags/flags.ts`
  - Supports Unleash, ConfigCat, and local flags
  - Priority: Low

- [x] Mobile shell scaffold
  - File: `apps/mobile/README.md`
  - Documentation and structure for mobile app
  - Priority: Low

- [x] Extension SDK planning
  - Files: `docs/EXTENSION_SDK.md`, `docs/EXTENSION_SDK_PLAN.md`
  - Complete SDK documentation and implementation plan
  - Priority: Low

---

## Success Metrics

### Week 1 Goals
- ✅ Agent Core expanded with 3+ new tools
- ✅ PDF viewer functional
- ✅ Query router implemented

### Week 2 Goals
- ✅ yt-dlp integration complete
- ✅ API server with auth + core endpoints
- ✅ Enhanced search pipeline

---

## Dependencies

### External
- `pdfium-node` or equivalent
- `yt-dlp` binary
- FastAPI, SQLAlchemy, Pydantic
- Qdrant client (already integrated)

### Internal
- Existing agent infrastructure ✅
- Hybrid search service ✅
- Cloud vector store ✅
- IPC system ✅

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| PDFium native module issues | High | Use `pdfjs-dist` as fallback |
| yt-dlp licensing concerns | Medium | Include user responsibility notice |
| API server complexity | Medium | Start minimal, iterate |
| Performance regressions | Low | Monitor with benchmarks |

---

## Daily Standup Template

**Yesterday**: What was completed?  
**Today**: What will be worked on?  
**Blockers**: Any impediments?

---

**Sprint Start**: TBD  
**Sprint End**: TBD  
**Sprint Lead**: Development Team

