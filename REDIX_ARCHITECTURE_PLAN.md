# Redix Architecture Plan: Universal Lightweight Browser

_Last updated: 2025-12-17_

## 🎯 Current State vs. Redix Vision

### ✅ **What You ALREADY Have (That Aligns with Redix)**

| Redix Requirement | Current Status | Notes |
|------------------|----------------|-------|
| **Design Tokens** | ✅ **COMPLETE** | `src/styles/tokens.css` - Full token system with spacing, colors, typography |
| **AI Integration** | ✅ **COMPLETE** | Redix backend (Python/FastAPI), LangChain agents, QueryEngine |
| **Privacy Stack** | ✅ **COMPLETE** | Tor, VPN, Shields, Consent Ledger |
| **Knowledge Graph** | ✅ **COMPLETE** | Graph service, citation tracking |
| **Content Extraction** | ✅ **COMPLETE** | Readability, research ingestion |
| **No iframes** | ✅ **COMPLETE** | Uses Electron BrowserView (not iframes) |

### ❌ **What's Missing for Universal Redix**

| Redix Requirement | Current Status | Gap |
|------------------|----------------|-----|
| **DOM Pooling** | ❌ Not implemented | Need object pool for tabs, buttons, divs |
| **WASM AI** | ❌ Cloud APIs only | Need TinyLlama WASM for offline/low-end devices |
| **Universal Build** | ⚠️ Electron only | Need lightweight web build (< 12KB) |
| **Low RAM Mode** | ❌ Full React bundle | Need vanilla JS fallback for < 2GB RAM devices |
| **Device Detection** | ❌ None | Need capability detection (WASM support, RAM, etc.) |

---

## 🏗️ **Redix Architecture: Dual Build Strategy**

### **Build 1: Electron Desktop (Current)**
- **Target**: Modern desktops (Windows, macOS, Linux)
- **Tech**: Electron + React + TypeScript
- **Size**: ~150MB (includes Chromium)
- **RAM**: ~200MB per tab
- **Features**: Full feature set, cloud AI, privacy stack

### **Build 2: Redix Universal (NEW)**
- **Target**: Any device with a screen (iPhone 5s, Android 4.4, Raspberry Pi, etc.)
- **Tech**: Vanilla JS + WASM + Design Tokens
- **Size**: < 12KB (gzipped)
- **RAM**: < 5MB per tab
- **Features**: Core browsing, WASM AI, DOM pooling, universal compatibility

---

## 📋 **Redix Universal Implementation Plan**

### **Phase 1: Core Redix Foundation (Week 1)**

#### **1.1 DOM Pooling System**
```javascript
// src/core/redix-pool.ts
export class RedixPool {
  private tabPool: HTMLElement[] = [];
  private buttonPool: HTMLButtonElement[] = [];
  private divPool: HTMLDivElement[] = [];
  private maxPoolSize = 50;

  getTab(): HTMLElement {
    const tab = this.tabPool.pop() || document.createElement('div');
    tab.className = 'tab';
    return tab;
  }

  returnTab(tab: HTMLElement): void {
    tab.innerHTML = '';
    tab.className = 'tab';
    if (this.tabPool.length < this.maxPoolSize) {
      this.tabPool.push(tab);
    }
  }

  // Similar for buttons, divs, etc.
}
```

#### **1.2 Device Capability Detection**
```javascript
// src/core/device-detector.ts
export class DeviceDetector {
  static detectCapabilities() {
    return {
      hasWASM: typeof WebAssembly !== 'undefined',
      hasWebGL: !!document.createElement('canvas').getContext('webgl'),
      ramEstimate: (navigator as any).deviceMemory || 4, // GB
      cpuCores: navigator.hardwareConcurrency || 2,
      isLowEnd: this.isLowEndDevice(),
    };
  }

  static isLowEndDevice(): boolean {
    const ram = (navigator as any).deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 2;
    return ram < 2 || cores < 2;
  }
}
```

#### **1.3 Redix Build Target**
```typescript
// vite.config.redix.ts (NEW)
export default defineConfig({
  build: {
    outDir: 'dist-redix',
    minify: 'terser',
    target: 'es2015', // Support older devices
    rollupOptions: {
      output: {
        format: 'iife', // Single file for universal compatibility
        entryFileNames: 'redix.js',
        manualChunks: undefined, // Single bundle
      },
    },
  },
  // Exclude React, use vanilla JS
  // Use design tokens only
});
```

---

### **Phase 2: WASM AI Integration (Week 2)**

#### **2.1 TinyLlama WASM Loader**
```javascript
// src/core/redix-ai-wasm.ts
export class RedixAIWASM {
  private model: any = null;
  private worker: Worker | null = null;

  async loadModel(): Promise<void> {
    // Load TinyLlama WASM (20MB, cached)
    const wasmUrl = '/wasm/tinyllama.wasm';
    const response = await fetch(wasmUrl);
    const wasmBytes = await response.arrayBuffer();
    
    // Initialize WASM module
    const wasmModule = await WebAssembly.instantiate(wasmBytes);
    this.model = wasmModule.instance;
  }

  async query(prompt: string): Promise<string> {
    if (!this.model) await this.loadModel();
    
    // Run inference in WASM
    return this.model.exports.infer(prompt);
  }
}
```

#### **2.2 AI Fallback Chain**
```javascript
// Redix AI Strategy:
// 1. Try WASM AI (offline, fast, universal)
// 2. Fallback to Redix backend (if available)
// 3. Fallback to cloud LLM (if API key available)
// 4. Fallback to simple keyword search
```

---

### **Phase 3: Universal Content Renderer (Week 3)**

#### **3.1 AI Content Renderer (No iframes)**
```javascript
// src/core/redix-renderer.ts
export class RedixContentRenderer {
  private pool: RedixPool;
  private ai: RedixAIWASM;

  async renderURL(url: string, container: HTMLElement): Promise<void> {
    // 1. Fetch content
    const content = await this.fetchContent(url);
    
    // 2. Extract with Readability
    const extracted = this.extractReadable(content);
    
    // 3. Process with AI (summarize, extract key points)
    const processed = await this.ai.processContent(extracted);
    
    // 4. Render as structured content (not iframe)
    const element = this.pool.getDiv();
    element.innerHTML = this.buildContentHTML(processed);
    container.appendChild(element);
  }

  private buildContentHTML(content: ProcessedContent): string {
    return `
      <article class="redix-content">
        <header>
          <h1>${content.title}</h1>
          <div class="meta">
            <span>${content.domain}</span>
            <span>${content.date}</span>
          </div>
        </header>
        <div class="summary">${content.summary}</div>
        <div class="body">${content.body}</div>
        <footer>
          <div class="sources">${content.sources.map(s => `<a href="${s.url}">${s.title}</a>`).join('')}</div>
        </footer>
      </article>
    `;
  }
}
```

---

### **Phase 4: Universal Build & Deployment (Week 4)**

#### **4.1 Build Scripts**
```json
// package.json additions
{
  "scripts": {
    "build:redix": "vite build --config vite.config.redix.ts",
    "dev:redix": "vite --config vite.config.redix.ts",
    "test:redix": "playwright test tests/e2e/redix-universal.spec.ts"
  }
}
```

#### **4.2 Universal Compatibility**
- **Target ES2015** (works on 99% of devices)
- **No dependencies** (vanilla JS only)
- **Progressive enhancement** (works without JS, degrades gracefully)
- **Service Worker** (offline support, WASM caching)

---

## 📊 **Redix Universal vs. Electron Desktop**

| Feature | Electron Desktop | Redix Universal |
|---------|-----------------|-----------------|
| **Bundle Size** | ~150MB | < 12KB |
| **RAM per Tab** | ~200MB | < 5MB |
| **Device Support** | Modern desktops | Any device with screen |
| **AI** | Cloud APIs | WASM (offline) |
| **Framework** | React + TypeScript | Vanilla JS |
| **DOM** | React Virtual DOM | Pooled DOM elements |
| **Content** | BrowserView | AI-rendered HTML |
| **Privacy** | Full stack (Tor/VPN) | Basic (ad blocking) |
| **Offline** | Limited | Full (WASM AI) |

---

## 🚀 **Implementation Roadmap**

### **Week 1: Foundation**
- [ ] Create `RedixPool` class
- [ ] Create `DeviceDetector` class
- [ ] Create `vite.config.redix.ts`
- [ ] Build minimal Redix bundle (< 12KB)

### **Week 2: WASM AI**
- [ ] Integrate TinyLlama WASM
- [ ] Create `RedixAIWASM` class
- [ ] Implement fallback chain
- [ ] Test on low-end devices

### **Week 3: Content Renderer**
- [ ] Create `RedixContentRenderer`
- [ ] Replace iframe approach with AI-rendered content
- [ ] Implement content extraction
- [ ] Test on various websites

### **Week 4: Universal Deployment**
- [ ] Build Redix universal bundle
- [ ] Test on old devices (iPhone 5s, Android 4.4)
- [ ] Deploy to GitHub Pages
- [ ] Create Redix documentation

---

## 💡 **Key Insight: Dual Architecture**

**You don't need to choose between Electron and Redix.**

**You can have BOTH:**

1. **Electron Desktop** = Full-featured browser for modern desktops
2. **Redix Universal** = Ultra-lightweight browser for any device

**They share:**
- Design tokens (already done ✅)
- Redix backend (already done ✅)
- Content extraction (already done ✅)
- Knowledge graph (already done ✅)

**They differ:**
- Electron = React, cloud AI, full privacy stack
- Redix = Vanilla JS, WASM AI, basic privacy

---

## 🎯 **Next Steps**

1. **Start with DOM Pooling** - Easy win, works in both builds
2. **Add Device Detection** - Enables adaptive features
3. **Create Redix Build Target** - Separate Vite config
4. **Integrate WASM AI** - For offline/low-end support
5. **Build Universal Renderer** - Replace iframes with AI content

**The foundation is already there. Redix Universal is the next evolution.** 🚀

