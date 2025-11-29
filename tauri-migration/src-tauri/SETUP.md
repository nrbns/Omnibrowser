# Regen Backend Setup - 5 Commands

## Quick Setup (30 minutes)

### 1. Create bin folder (already done)

```bash
mkdir src-tauri/bin
```

### 2. Download Binaries (one-time)

**Ollama:**

- Download from: https://ollama.com/download/OllamaSetup.exe
- Install globally (recommended) OR place `ollama.exe` in `src-tauri/bin/`

**MeiliSearch (optional):**

```bash
curl -L https://github.com/meilisearch/meilisearch/releases/download/v1.10.0/meilisearch-windows-amd64.exe -o src-tauri/bin/meilisearch.exe
```

**n8n (optional):**

```bash
curl -L https://github.com/n8n-io/n8n/releases/latest/download/n8n.exe -o src-tauri/bin/n8n.exe
```

### 3. Build & Run

```bash
cd tauri-migration/src-tauri
cargo tauri dev
```

## What Happens on Launch

1. ✅ App opens → Ollama auto-starts (if installed)
2. ✅ Model `llama3.2:3b` auto-pulls (first time only)
3. ✅ Research mode → streams answers in real-time
4. ✅ Trade mode → live prices + AI signals
5. ✅ WISPR → works with Ollama

## Troubleshooting

**Ollama not starting?**

- Install Ollama globally: https://ollama.com/download
- Or place `ollama.exe` in `src-tauri/bin/`

**Model not found?**

- Run manually: `ollama pull llama3.2:3b`
- Wait 2-3 minutes for first download

**Port 11434 in use?**

- Stop other Ollama instances: `taskkill /F /IM ollama.exe`
- Restart app

## Production Build

```bash
cargo tauri build
```

This creates a 250MB installer with everything bundled.
