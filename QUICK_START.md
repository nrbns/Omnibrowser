# Quick Start Guide

## 🚀 Running the Project

### Option 1: Automatic (Recommended)
```bash
# From project root
.\scripts\start-project.ps1
```

### Option 2: Manual

#### Step 1: Start Backend
```bash
cd server
npm install  # First time only
node redix-server.js
```

**Expected Output:**
```
Redix server listening on port 4000
WebSocket server initialized
```

#### Step 2: Start Tauri (New Terminal)
```bash
cd tauri-migration
npm install  # First time only
npm run tauri dev
```

**Expected:**
- Vite dev server starts on port 5173
- Tauri window opens automatically
- App loads in Tauri window

## ✅ Verification

### Backend Running?
- Check: http://127.0.0.1:4000/api/ping
- Should return: `"pong"`

### Tauri Running?
- Tauri window should be open
- Check console for errors
- UI should render

## 🔧 Troubleshooting

### Backend Won't Start
- **Error**: "Cannot find module '@fastify/cors'"
  - **Fix**: `cd server && npm install`

### Tauri Won't Start
- **Error**: "Tauri CLI not found"
  - **Fix**: `npm install -g @tauri-apps/cli`
  
- **Error**: "Rust not found"
  - **Fix**: Install from https://rustup.rs/

- **Error**: "Cannot find module 'react'"
  - **Fix**: `cd tauri-migration && npm install`

### CORS Errors
- Verify backend is running
- Check `server/redix-server.js` has CORS configured
- Verify Tauri origin is in allowed list

## 📊 Project Status

- ✅ Backend: 70+ API endpoints ready
- ✅ Frontend: All components migrated
- ✅ Integration: HTTP API client ready
- ✅ Configuration: All configs in place

---

**Status**: Ready to run! 🎉


