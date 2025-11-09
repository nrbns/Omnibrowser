# OmniBrowser Integration Manual

This guide enumerates every external integration currently wired into OmniBrowser, the APIs they depend on, and the exact configuration steps required to bring each one online in staging or production. Use it as the single source of truth when rotating credentials, onboarding a new environment, or extending support to additional providers.

---

## Contents

1. [Research & Retrieval Stack](#research--retrieval-stack)
2. [Productivity & Knowledge Exports](#productivity--knowledge-exports)
3. [Expert Tool Modules](#expert-tool-modules)
4. [Command Marketplace & Auto-Actions](#command-marketplace--auto-actions)
5. [Monitoring, Telemetry, and Compliance Services](#monitoring-telemetry-and-compliance-services)
6. [Common Setup Checklist](#common-setup-checklist)
7. [Credential Rotation Playbook](#credential-rotation-playbook)

---

## Research & Retrieval Stack

| Integration | Purpose | API / Endpoint | Auth Model | Notes |
|-------------|---------|----------------|------------|-------|
| **DuckDuckGo Search** | Primary zero-click search provider for hybrid Research Mode | `https://duckduckgo.com/?q=<query>&format=json` (Lite API) | No auth required | Used for quick breadth; requests are proxied through stealth container to avoid fingerprinting. |
| **Brave Search API (optional)** | Supplemental private search results | `https://api.search.brave.com/res/v1/web/search` | API Key via `Authorization: Bearer <token>` | Enable in `config/services/brave.json`. Handle rate limit headers `X-RateLimit-Remaining`. |
| **Custom crawler / readability fetch** | Deep content extraction for citations | Internal Electron `stealthFetchPage()` -> off-screen `BrowserView` | Browser partition isolation | Applies Readability.js post-fetch. No external auth. |
| **Evidence Verification (LLM)** | Inline contradiction/bias scoring | Local: `http://localhost:11434/api/generate` (Ollama) <br> Cloud fallback: OpenAI `https://api.openai.com/v1/chat/completions` | Local: none <br> Cloud: API key + Consent Ledger approval | Configure in `settings.json` under `ai.provider` and `ai.model`. Consent prompts guard cloud usage. |
| **Timeline Intelligence** | Build chronological evidence boards | Combines session bundles + research fetcher | Internal service | Data stored in `userData/research`. |

### Enable Sequence
1. Populate `config/search.json` with preferred providers and weightings.
2. For Brave, add `BRAVE_SEARCH_KEY` to environment and mark consent reason in `settings.schema.ts`.
3. Confirm stealth partitions are active (`ContainerManager` logs). Without isolation, requests may leak cookies.
4. Run `npm run test:research` to execute integration smoke tests.

---

## Productivity & Knowledge Exports

| Integration | Purpose | API Scope | Auth Instructions | Additional Configuration |
|-------------|---------|-----------|-------------------|--------------------------|
| **Notion Export** | Sync research highlights & notes to Notion database | `https://api.notion.com/v1/pages` & `v1/blocks` | Internal integration token stored in `NOTION_TOKEN` | User must provide database ID in Settings → Integrations. Respect Notion rate limits (3 req/s). |
| **Obsidian Export** | Write markdown bundle to local vault | Filesystem write (no network) | None | Path configured via Settings → Integrations. Uses sanitized filenames + frontmatter for citations. |
| **GitHub Issues** | Push research tasks or findings into GitHub issue tracker | GitHub REST v3: `POST /repos/{owner}/{repo}/issues` | Personal access token with `repo` scope stored in `GITHUB_TOKEN` | Repository config lives in `settings.integrations.github`. Attach citations summary as issue body. |
| **Markdown/CSV Export** | Offline bundle for archiving | Local file writes | None | Managed by `research:export` IPC handler. |
| **Session Bundles Storage** | Archive workspace sessions | Local `userData/session-bundles/*.json` | None | Toggle in Settings → Sessions to enable autosave frequency. |

### Enable Sequence
1. Collect tokens from target workspace owners (Notion, GitHub). NEVER commit tokens.
2. Store tokens in OS keychain or `.env.local`. Update `electron/services/storage.ts` to read environment variables.
3. Verify consent prompts show for cloud sync operations (Consent Ledger event `integrations push`).
4. Run `npm run smoke:integrations` to check connectors (script expected to return success JSON). |

---

## Expert Tool Modules

| Module | Data Source | API Details | Auth | Implementation Notes |
|--------|-------------|-------------|------|----------------------|
| **Finance** | SEC EDGAR | `https://data.sec.gov/submissions/CIK<fmt>.json` and filing endpoints | SEC expects descriptive `User-Agent` header containing contact email. | Configure `SEC_CONTACT_EMAIL` in env. Module caches responses to `userData/edgar-cache`. |
| **Science** | PubMed & arXiv | PubMed E-utilities (`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`) <br> arXiv RSS/Atom (`http://export.arxiv.org/api/query`) | No auth | Rate-limit PubMed (max 3 req/sec). Use query batching to avoid throttling. |
| **Law** | CourtListener (opinions) and GovInfo (statutes) | CourtListener API `https://www.courtlistener.com/api/rest/v3/opinions/?search=<query>` <br> GovInfo `https://api.govinfo.gov/collections/USCODE` | CourtListener requires token; set `COURTLISTENER_TOKEN`. GovInfo uses API key `GOVINFO_KEY`. | Map results into normalized `LegalDocument` type with citations metadata. |
| **Domain Extractors** | Internal ML pipeline | Local model endpoints `http://localhost:5005/extract` | None | Handles entity extraction, claim detection, timeline building. |
| **Domain Citation Styles** | CSL processor | Local library (`citation-js`). No external calls. | None | Templates stored in `resources/citation-styles/`. |

### Enable Sequence
1. Populate required keys in environment file (SEC, CourtListener, GovInfo).
2. Run `npm run test:experts` to hit each endpoint with sample queries.
3. Confirm storage folder permissions so cached documents can be written (esp. EDGAR). |

---

## Command Marketplace & Auto-Actions

| Feature | API | Auth | Notes |
|---------|-----|------|-------|
| **Command Registry Sync** | Internal REST `https://commands.omnibrowser.dev/api/v1/commands` | API Key `COMMAND_MARKET_KEY` | Responses validated with signature header `X-Commands-Signature`. Store hashed commands locally. |
| **Security Review Service** | `https://commands.omnibrowser.dev/api/v1/reviews` | Uses same key as registry | Uploads command manifest for automated scanning. |
| **Watchers / Auto-Actions** | OmniBrowser internal scheduler | None | Configurable via `watchers.config.json`. Uses stealth fetch to monitor pages. |
| **Alert Delivery** | Email / webhook (optional) | Depends on provider (SMTP credentials or webhook token) | Provide `SMTP_URL` or `WEBHOOK_URL` in config if alerting beyond in-app notifications is required. |

### Enable Sequence
1. Request marketplace key from platform team; store in secure secret store.
2. Configure watchers via `Settings → Automation` to set polling intervals.
3. Run `npm run test:commands` to ingest sample command pack and validate review loop. |

---

## Monitoring, Telemetry, and Compliance Services

| Integration | Purpose | API / Endpoint | Auth | Notes |
|-------------|---------|----------------|------|-------|
| **Crash Reporting (Sentry)** | Capture opt-in crash dumps | `https://sentry.io/api/<project>/store/` via Sentry JavaScript SDK | DSN stored in `SENTRY_DSN` | Feature toggled off by default; user must opt-in. |
| **Performance Monitoring (OpenTelemetry Collector)** | Measure renderer / main metrics | gRPC exporter to `otel-collector.omnibrowser.dev:4317` | API Key `OTEL_EXPORTER_OTLP_HEADERS="api-key=<token>"` | Only active if telemetry toggle enabled. |
| **Error Tracking (Internal)** | Aggregate non-crash errors | Internal log forwarder `https://diagnostics.omnibrowser.dev/logs` | Bearer token `DIAGNOSTICS_TOKEN` | Guarded by consent prompt. |
| **User Analytics (Privacy-Preserving)** | Capture anonymized usage events | `https://analytics.omnibrowser.dev/collect` | Public write key + local differential privacy salt | Optional; disabled by default. |

### Enable Sequence
1. Define telemetry policy in `settings/privacy.json`. Ensure default is opt-in = false.
2. Configure tokens in environment variables. Never ship tokens in repo.
3. Verify consent flow by toggling telemetry in Settings and checking logs for event `profiles:policy-blocked` or `telemetry:consented`. |

---

## Common Setup Checklist

1. **Provision Secrets**: Use 1Password vault “OmniBrowser Integrations” for API keys. Export to `.env.integration` on build agents only.
2. **Set Environment Variables**: Copy `.env.example` → `.env.local` and populate the relevant keys discussed above.
3. **Update Settings Schema**: For every new integration, add schema entry in `electron/shared/settings/schema.ts` and default values in `electron/services/storage.ts`.
4. **Consent Ledger Hooks**: If an integration reaches out to a cloud API, ensure `ensureConsent()` wraps the request with an appropriate `ConsentAction` payload.
5. **CI Smoke Tests**: Run `npm run test:integrations` and `npm run test:telemetry`. CI will fail if any critical integration is misconfigured.
6. **Documentation**: Update this manual whenever new providers or auth methods are added. |

---

## Credential Rotation Playbook

1. Announce rotation window in #devops at least 24h prior.
2. Generate new credentials from provider dashboard (e.g., Notion integrations page, GitHub developer settings).
3. Update secrets store (1Password entry) and environment templates.
4. Deploy new secrets to staging first. Run smoke tests.
5. Promote to production after validating event logs / consent prompts.
6. Invalidate old keys at provider level to prevent reuse.
7. Record rotation in `SECURITY.md` (internal) with timestamp and operator initials. |

---

### Need Help?

- Integration errors surface via the Diagnostics panel (`Settings → Diagnostics`). Review `omnibrowser.log` for failed calls.
- Contact the Infrastructure team in `#omnibrowser-ops` with the integration name, environment, and failing endpoint for escalation.


