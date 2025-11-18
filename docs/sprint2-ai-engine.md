# Sprint 2 – Unified AI Engine Plan

_Last updated: 2026‑01‑05_

## 1. Goals

1. **Single orchestration layer** for all AI requests (search synthesis, agents, scratchpad prompts) with shared logging, cost tracking, and retries.
2. **Streaming-first responses** end‑to‑end (LLM provider → backend → renderer) with graceful fallback to buffered mode.
3. **Provider + model routing** rules (OpenAI, Anthropic, Mistral, Ollama/local) driven by task type, cost ceilings, and feature flags.
4. **Centralized safeguards** (prompt templating, PII scrubbing, max tokens) to avoid duplicated logic across search, agents, and panels.
5. **Extensibility** for future tools (web summarizer, notebook agent, trade copilots) without repeating glue code.

## 2. Current State (Sprint 1)

| Surface | Flow Today | Gaps |
|---------|-----------|------|
| `SearchBar` | Hits `/api/search_llm` → `aggregate_search` → `_synthesize_answer` using OpenAI streaming helper | Separate backend pipeline; no shared cost limits; no incremental telemetry |
| Agent runtime (`useAgentExecutor`) | Directly uses `sendPrompt` (multi-provider fallback) per agent tick | Each agent replicates prompts, lacks shared throttling/context caching |
| Legacy Redix `/ask` | Renderer fetches SSE from Redix core (python) | Different streaming protocol, no shared provider config |
| Misc surfaces (`Ask about page`, memory) | Use `sendPrompt` with ad-hoc options | No unified tracing/analytics |

## 3. Target Architecture

```
Renderer task (search/agent/chat)
        │
        ▼
┌───────────────────────────────┐
│ Frontend SDK (AI Engine API)  │
│ - normalize request payload   │
│ - streaming event handling    │
└─────────────┬─────────────────┘
              │ HTTP/SSE
┌─────────────▼─────────────────┐
│ Backend AI Orchestrator       │
│ 1. Task Router                │
│    - route by intent (search, agent, summary, tool)          │
│    - attach policy (model tier, token caps, retries)         │
│ 2. Provider Connector         │
│    - OpenAI, Anthropic, Mistral, Ollama                      │
│    - consistent streaming payload + telemetry                │
│ 3. Post-processor            │
│    - citations, formatting, cost logging                     │
└─────────────┬─────────────────┘
              │
┌─────────────▼─────────────────┐
│ Shared Services               │
│ - Search aggregator (optional pre-step)                      │
│ - Memory/cache (per task)                                    │
│ - Metrics store (cost, latency, errors)                      │
└───────────────────────────────┘
```

## 4. Work Breakdown

### 4.1 Renderer SDK (new `AIEngine` module)
- Provide `runTask({ kind: 'search' | 'chat' | 'agent', payload })`.
- Handle streaming events via `ReadableStream` → callback.
- Enforce local guardrails (e.g. block empty prompts, attach active mode metadata).
- Support offline fallback (use `sendPrompt` locally / show warning).

### 4.2 Backend Orchestrator
1. **Task Router** FastAPI route (`/api/ai/task`) with payload:
   ```json
   { "kind": "search", "query": "...", "context": {...}, "mode": "Research", "flags": ["cost:low"] }
   ```
2. **Policy Engine**
   - Map `kind + mode` → provider/model specification, token ceilings, streaming enable flag.
   - Provide override via feature flags/env.
3. **Provider Connectors**
   - Reuse `apps/api/openai_client` for streaming; add wrappers for Anthropic/Mistral; optionally proxy to Redix for local caches.
4. **Streaming Bridge**
   - Use `fastapi.responses.StreamingResponse` to push `data:` events with `event: token|done|error`.
   - Fallback to buffered response on provider error.
5. **Cost & Telemetry**
   - Log per call: provider, model, tokens, latency, cached/not, user mode.
   - Optional per-user monthly quota placeholder.

### 4.3 Migration Steps
1. **SearchBar** → call new `/api/ai/task` with `{ kind: 'search' }` (keeps aggregated search step but receives streaming answer & citations).
2. **Agents** → update executor to request `kind: 'agent'` so retries/cost tracked centrally.
3. **Redix `/ask`** → behind the scenes, Orchestrator can delegate to Redix provider or remote LLM.
4. **Legacy `sendPrompt`** → wrap around AIEngine for unsupported contexts; mark for deprecation.

### 4.4 Safeguards & Cost Controls
- Per task token + latency budgets (e.g. search: 700 tokens; agent step: 1000).
- Automatic downgrade to cheaper model after first failure or when `flags` request low-cost mode.
- Minimum delay between expensive requests per user to prevent bursts.
- Central prompt template store (system prompts versioned).

## 5. Deliverables
1. Renderer SDK stub (`src/core/ai/engine.ts`) with typed interface + `window` event hooks ✅ (Sprint 2 kickoff).
2. Backend `/api/ai/task` route with router/policy/connector scaffolding.
3. Streaming response contract doc.
4. Migration PRs for SearchBar + agent runtime.
5. Observability dashboard (tokens, latency, error rate) + alert thresholds.

## 6. Open Questions
- Do we host vector context building (RAG) inside orchestrator or keep per feature? (Proposal: keep per feature for Sprint 2; move later.)
- How should we persist cost telemetry (Postgres vs. simple log)? (Short term: structured logs + OpenTelemetry.)
- When do we enable user-provided API keys vs. org-level keys? (Need PM decision.)

