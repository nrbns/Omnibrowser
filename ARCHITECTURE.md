# OmniBrowser Architecture Decoded

**A comprehensive analysis of OmniBrowser's architecture compared to modern AI-powered browsers (Atlas, Comet, Brave, Perplexity, Chrome/Edge)**

---

## 🧠 Executive Summary

OmniBrowser is an **Electron-based, privacy-first, AI-powered browser** that combines:

- **Base Engine**: Chromium (via Electron) → Blink rendering + V8 JavaScript
- **Backend Language**: TypeScript/Node.js (main process) + React (renderer)
- **AI Layer**: Agent system with Ollama integration + mode-specific agents
- **Privacy Stack**: Brave-style Shields + Tor + VPN + DoH
- **Architecture Pattern**: Multi-process (Main + Renderer) with typed IPC

**Positioning**: Similar to **Atlas/Comet** (AI-first) + **Brave** (privacy-first) + **Perplexity** (knowledge layer)

---

## 🏗️ Current Architecture Layers

### **1. Process Architecture (Electron-based)**

```
┌─────────────────────────────────────────┐
│         Main Process (Node.js)          │
│  • BrowserWindow management             │
│  • IPC handlers (typed with Zod)        │
│  • Service orchestration                │
│  • Security policies                    │
└──────────────┬──────────────────────────┘
               │ IPC (ob://ipc/v1/*)
               │
┌──────────────┴──────────────────────────┐
│      Renderer Process (React/Vite)      │
│  • UI (TopNav, TabStrip, MainView)     │
│  • State management (Zustand)          │
│  • Real-time IPC event listeners        │
│  • Mode-specific panels                │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│      BrowserView Process (per tab)      │
│  • Web content rendering (Blink/V8)     │
│  • Session isolation (per-profile)      │
│  • Shields protection                   │
│  • Video call optimization              │
└─────────────────────────────────────────┘
```

**Comparison to Native Chromium**:
- ✅ **Similar**: Multi-process isolation, security sandboxing
- ❌ **Different**: Electron adds Node.js layer (more memory, but easier development)
- 🎯 **Advantage**: Faster development, cross-platform, rich Node.js ecosystem

---

### **2. Core Service Layer**

OmniBrowser has **50+ service modules** organized by domain:

#### **A. AI & Agent Services**
```
electron/services/agent/
├── brain.ts              # DSL execution engine
├── host.ts                # Task orchestration
├── ollama-adapter.ts      # Local LLM integration
├── chains/
│   └── deep-research.ts  # RAG-style research chains
└── skills/               # Tool registry (navigation, extraction, etc.)

electron/services/knowledge/
├── citation-graph.ts     # Entity-relationship graph
├── clustering.ts         # Topic clustering (embeddings)
├── pdf-parser.ts        # Document parsing
└── vector-store.ts      # Local RAG (OmniBrain)

electron/services/cognitive/
└── persona-learning.ts  # User behavior learning
```

**Comparison to Atlas/Comet/Perplexity**:
- ✅ **Similar**: Agent-based orchestration, RAG capability, local model support
- ✅ **Implemented**: Cloud vector DB (Qdrant/Pinecone) - `electron/services/knowledge/cloud-vector-store.ts`
- ✅ **Completed**: Optional cloud sync for knowledge graph with UI integration

---

#### **B. Privacy & Security Services**
```
electron/services/
├── shields.ts            # Brave-style ad/tracker blocking
├── tor.ts                # Tor integration (NEWNYM)
├── vpn.ts                # VPN proxy management
├── dns.ts                # DNS-over-HTTPS
├── private.ts            # Private window partitions
├── burn.ts               # Tab/data wiping
└── self-defense/
    ├── fingerprint-cloak.ts
    └── ghost-tabs.ts
```

**Comparison to Brave**:
- ✅ **Similar**: Shields, Tor mode, fingerprint protection
- ✅ **Better**: More granular controls (DoH, QUIC toggle, IPv6 leak protection)
- 🎯 **Advantage**: Unified privacy stack (Brave + Tor + VPN in one)

---

#### **C. Network & Performance Services**
```
electron/services/
├── proxy.ts              # Per-tab proxy routing
├── network-controls.ts   # QUIC/IPv6 controls
├── tab-sleep.ts          # Memory management
├── memory.ts             # Tab memory monitoring
├── performance/
│   ├── gpu-controls.ts  # Hardware acceleration
│   └── crash-recovery.ts
└── video-call-optimizer.ts
```

**Comparison to Chrome/Edge**:
- ✅ **Similar**: Multi-process isolation, memory management
- ✅ **Better**: Explicit tab hibernation, per-tab proxy routing
- 🎯 **Advantage**: Fine-grained performance controls

---

#### **D. Storage & Sync Services**
```
electron/services/
├── storage.ts            # SQLite-based settings/history
├── sessions.ts           # Multi-session isolation
├── profiles.ts           # Profile management
├── workspace-v2.ts       # Workspace save/restore
└── secrets.ts            # keytar-based secrets
```

**Comparison to Chrome/Edge**:
- ✅ **Similar**: Local storage (IndexedDB, SQLite)
- ✅ **Implemented**: E2EE sync (Brave Sync 2.0 style) - `electron/services/sync/e2ee-sync.ts`
- ✅ **Completed**: Encrypted chain sync with UI integration in Settings

---

### **3. IPC Communication Layer**

**Typed IPC System** (inspired by modern microservices):

```typescript
// Schema-first approach (Zod)
electron/shared/ipc/
├── schema.ts            # Request/Response schemas
└── router.ts            # Versioned channels (ob://ipc/v1/*)

// Client-side
src/lib/ipc-typed.ts    # Type-safe IPC client

// Event bus for real-time updates
src/lib/ipc-events.ts    # Event emitter pattern
```

**Comparison to Chromium Mojo IPC**:
- ✅ **Similar**: Type-safe, versioned channels
- ✅ **Better**: Schema validation at runtime (Zod)
- 🎯 **Advantage**: Developer-friendly, TypeScript-first

---

### **4. Rendering Pipeline**

OmniBrowser leverages **Electron's BrowserView** for tab rendering:

```
User navigates
    ↓
BrowserView.webContents.loadURL()
    ↓
Chromium Network Stack (via Electron)
    ↓
Blink Engine (HTML/CSS parsing)
    ↓
V8 Engine (JavaScript execution)
    ↓
Compositing (GPU-accelerated)
    ↓
Display (via BrowserView bounds)
```

**Comparison to Native Chromium**:
- ✅ **Same rendering engine**: Blink + V8
- ❌ **Overhead**: Electron adds ~100-200MB memory
- 🎯 **Trade-off**: Easier development vs. native performance

---

## 🔄 Architecture Comparison Matrix

| Feature | OmniBrowser | Atlas | Comet | Brave | Perplexity | Chrome/Edge |
|---------|------------|-------|-------|-------|------------|-------------|
| **Base Engine** | Chromium (Electron) | Chromium | Chromium | Chromium | Chromium (browser) | Chromium |
| **JS Engine** | V8 | V8 | V8 | V8 | V8 | V8 |
| **Backend Language** | TypeScript/Node.js | Node.js + Rust | Node.js/Python | C++/Rust/Go | Go + Python | C++ |
| **AI Integration** | ✅ Ollama + Agent | ✅ LLM API | ✅ LLM API | ✅ Leo (local) | ✅ LLM RAG | ✅ Gemini/Copilot |
| **Privacy Stack** | ✅ Shields + Tor + VPN | Medium | Medium | ✅ Extremely High | Medium | Basic |
| **Knowledge Graph** | ✅ Local + Citation | Cloud Vector DB | Cloud Vector DB | No | ✅ Vector DB | No |
| **Sync** | ❌ Local only | Cloud | Cloud | ✅ E2EE Sync | Cloud | Google/MS Account |
| **Process Model** | Main + Renderer | Multi-process | Multi-process | Multi-process | Multi-process | Multi-process |
| **IPC System** | Typed (Zod) | Unknown | Unknown | Mojo | REST/WS | Mojo |
| **Storage** | SQLite + IndexedDB | IndexedDB + Cloud | SQLite + Cloud | SQLite + Encrypted | Redis + PostgreSQL | IndexedDB + Cloud |

---

## 🚀 Architecture Enhancements (Based on Analysis)

### **Priority 1: Cloud Vector DB Integration** ✅ (Atlas/Comet/Perplexity Pattern) - **COMPLETE**

**Status**: ✅ Fully implemented and integrated

**Implementation**:
- ✅ Service: `electron/services/knowledge/cloud-vector-store.ts`
- ✅ IPC: `electron/services/knowledge/cloud-vector-ipc.ts`
- ✅ UI: Settings → Cloud Vector DB section
- ✅ Features:
  - Qdrant and Pinecone support
  - Auto-sync from local knowledge graph
  - Cross-device semantic search
  - Configurable endpoint and API keys

---

### **Priority 2: Hybrid Search Backend** ✅ (Perplexity Pattern) - **COMPLETE**

**Status**: ✅ Fully implemented and integrated

**Implementation**:
- ✅ Service: `electron/services/search/hybrid-search.ts`
- ✅ IPC: `electron/services/search/hybrid-search-ipc.ts`
- ✅ UI: Settings → Hybrid Search section
- ✅ Features:
  - Multi-source aggregation (Brave, Bing, Custom crawler)
  - ML-based reranking
  - Citation tracking integration
  - Configurable source enable/disable
  - Max results configuration

---

### **Priority 3: E2EE Sync System** ✅ (Brave Pattern) - **COMPLETE**

**Status**: ✅ Fully implemented and integrated

**Implementation**:
- ✅ Service: `electron/services/sync/e2ee-sync.ts`
- ✅ IPC: `electron/services/sync/e2ee-sync-ipc.ts`
- ✅ UI: Settings → E2EE Sync section
- ✅ Features:
  - Encrypted chain (no central server required)
  - Peer-to-peer or optional relay server
  - Password-based encryption key derivation
  - Sync targets: Bookmarks, History, Knowledge graph, Workspaces, Settings
  - Initialize and manual sync controls

---

### **Priority 4: Advanced Process Isolation** ✅ (Chrome/Edge Pattern) - **COMPLETE**

**Status**: ✅ Fully implemented

**Implementation**:
- ✅ Enhanced in: `electron/services/tabs.ts`
- ✅ Features:
  - Site-based partition isolation (origin hashing)
  - Each origin gets unique partition: `persist:site:{originHash}`
  - Profile-aware: `persist:acct:{profileId}:site:{originHash}`
  - Prevents cross-site data leaks
  - Automatic origin-based session isolation

---

### **Priority 5: Real-time AI Streaming** ✅ (Atlas/Comet Pattern) - **COMPLETE**

**Status**: ✅ Fully implemented and integrated

**Implementation**:
- ✅ Service: `electron/services/agent/streaming-ipc.ts`
- ✅ Adapter: `electron/services/agent/streaming-adapter.ts`
- ✅ UI: `src/routes/AgentConsole.tsx` (streaming display)
- ✅ Features:
  - Real-time token streaming via IPC events
  - Async generator-based streaming adapter
  - Live text display in Agent Console
  - Start/Stop stream controls
  - Configurable model, temperature, maxTokens

---

## 📊 Architecture Diagram (Current + Enhanced)

### **Current Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process (Node.js)                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Agent Core  │  │ Privacy Stack│  │ Network Layer│   │
│  │ (Ollama)    │  │ (Shields/Tor)│  │ (Proxy/VPN)  │   │
│  └─────────────┘  └──────────────┘  └──────────────┘   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Knowledge   │  │ Storage      │  │ Performance   │   │
│  │ Graph        │  │ (SQLite)     │  │ (Sleep/Mem)  │   │
│  └─────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
                        │ IPC (Typed)
                        ↓
┌─────────────────────────────────────────────────────────┐
│              Renderer Process (React)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ UI Shell    │  │ State Mgmt   │  │ Event Bus    │   │
│  │ (TopNav/    │  │ (Zustand)    │  │ (IPC Events) │   │
│  │  TabStrip)  │  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
                        │ BrowserView
                        ↓
┌─────────────────────────────────────────────────────────┐
│         BrowserView Process (per tab)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Blink       │  │ V8           │  │ Shields      │   │
│  │ (Rendering) │  │ (JS Engine) │  │ (Protection) │   │
│  └─────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### **Enhanced Architecture (with cloud sync)**

```
┌─────────────────────────────────────────────────────────┐
│              Main Process + Cloud Services              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Agent Core  │  │ Vector DB    │  │ Hybrid       │   │
│  │ (Ollama +   │  │ (Qdrant)     │  │ Search       │   │
│  │  Streaming) │  │              │  │ (Brave/Bing) │   │
│  └─────────────┘  └──────────────┘  └──────────────┘   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ E2EE Sync   │  │ Privacy Stack│  │ Network      │   │
│  │ (Encrypted) │  │ (Shields/Tor)│  │ (Proxy/VPN)  │   │
│  └─────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 Code-Level Structure (Chromium-Inspired)

OmniBrowser's structure mirrors Chromium's organization:

```
omnibrowser/
├── electron/
│   ├── main.ts              # Main process (like chrome/main.cc)
│   ├── services/            # Service layer (like content/services/)
│   │   ├── tabs.ts         # Tab management (like chrome/browser/tabs/)
│   │   ├── agent/          # AI layer (like chrome/ai/)
│   │   ├── privacy/        # Privacy layer (like chrome/privacy/)
│   │   └── network/        # Network layer (like net/)
│   ├── shared/             # Shared code (like base/)
│   │   └── ipc/            # IPC schemas (like mojo/)
│   └── preload.ts          # Preload script (like content/renderer/)
├── src/
│   ├── components/         # UI components (like ui/)
│   ├── lib/                # Utilities (like base/)
│   └── routes/             # Pages (like chrome/browser/ui/)
└── package.json            # Dependencies (like DEPS)
```

---

## 🎯 Recommendations

### **Short-term (Next Sprint)** ✅ **COMPLETE**

1. ✅ **Cloud Vector DB** → Cross-device knowledge sync implemented
2. ✅ **Streaming AI** → Real-time token streaming implemented
3. ✅ **Hybrid Search** → Multi-source search aggregation implemented

### **Medium-term (Next Quarter)** ✅ **COMPLETE**

4. ✅ **E2EE Sync** → Brave-style encrypted sync implemented
5. ✅ **Site Isolation** → Origin-based partition isolation implemented
6. 🔄 **Performance Profiling** → Chrome DevTools integration (to be added)

### **Long-term (Next Year)**

7. **Native Module** → Replace Electron with Chromium fork (like Brave)
8. **Web3 Integration** → Built-in wallet (like Opera/Brave)
9. **Local LLM Runtime** → Full offline AI (like Brave Leo local)

---

## 📚 References

- [Chromium Architecture](https://chromium.org/developers/design-documents)
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Brave Architecture](https://brave.com/privacy/browser/)
- [Perplexity Backend](https://www.perplexity.ai/)

---

**Last Updated**: 2024-12-19
**Version**: 1.0.0
**Status**: ✅ Architecture Complete - All priority enhancements implemented and integrated into UI

