# 🚀 QUICK START - Everything Works in 5 Minutes

## ✅ What's Fixed

1. **Ollama Backend** - OLLAMA_ORIGINS set, auto-starts, no 403 errors
2. **Iframe Blocking** - CSP null, iframe invoke shim added
3. **Yahoo Finance** - Proper User-Agent, no CORS blocks
4. **MeiliSearch** - Auto-starts from PATH or bin directory
5. **Real-time Streaming** - Research & Trade stream tokens in real-time

## 🎯 3 Commands to Run

```bash
# 1. Install Ollama (if not installed)
# Download from: https://ollama.com/download/OllamaSetup.exe
# Or: winget install Ollama.Ollama

# 2. Build & Run
cd tauri-migration/src-tauri
cargo tauri dev

# 3. Test Everything
# - Research: Type "निफ्टी vs बैंकनिफ्टी" → streams answer in Hindi
# - Trade: Click NIFTY → live price + AI signal streams
# - Browse: Open iframe → Google/DuckDuckGo loads (no blank)
```

## 📋 What Happens on Launch

1. ✅ App opens
2. ✅ Ollama auto-starts (if installed)
3. ✅ Model `llama3.2:3b` auto-pulls (first time only, ~2GB)
4. ✅ MeiliSearch auto-starts (if in PATH or bin/)
5. ✅ `backend-ready` event fires when everything is ready

## 🔧 Event Names (Frontend Should Listen)

- `research-start` - Research query started
- `research-token` - Streaming token (append to UI)
- `research-end` - Research complete
- `trade-price` - Live price update `{price, change}`
- `trade-token` - Streaming AI signal token
- `trade-stream-start` - Trade analysis started
- `trade-stream-end` - Trade analysis complete
- `ollama-ready` - Ollama is ready
- `backend-ready` - All services ready
- `iframe-call` - Invoke from iframe (use shim)

## 🐛 Troubleshooting

**Ollama 403 errors?**

- ✅ Fixed: OLLAMA_ORIGINS is set to "\*" in setup
- Check: `curl http://localhost:11434/api/tags` should work

**Iframes blank?**

- ✅ Fixed: CSP is null in tauri.conf.json
- Check: Browser console for CSP errors

**Yahoo Finance CORS?**

- ✅ Fixed: User-Agent set to Mozilla/5.0
- Check: Network tab for 200 responses

**MeiliSearch not starting?**

- Install: Download from https://www.meilisearch.com/downloads
- Or: Place `meilisearch.exe` in `src-tauri/bin/`

## 🎉 Production Build

```bash
cargo tauri build
```

Creates installer with everything bundled. First launch auto-starts all services.
