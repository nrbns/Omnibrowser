# OmniBrowser Quick Start Guide

_Welcome to OmniBrowser! This guide will help you get started in minutes._

---

## 🚀 **Installation**

### Prerequisites
- **Node.js** 20 or higher
- **npm** or **pnpm** or **yarn**
- **Python** 3.11+ (for API server)
- **Electron** (bundled with the project)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Omnibrowser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp example.env .env
   # Edit .env and add your API keys:
   # - OPENAI_API_KEY (optional, for AI features)
   # - ANTHROPIC_API_KEY (optional, for Claude AI)
   # - OLLAMA_BASE_URL (optional, for local AI)
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **In a separate terminal, start the API server**
   ```bash
   # Windows
   npm run start:api

   # Linux/Mac
   python -m apps.api.main
   ```

6. **Open the app**
   - The Electron app should launch automatically
   - Or visit `http://localhost:5173` in your browser

---

## 🎯 **Core Features**

### **1. Browse Mode**
- Navigate the web like a traditional browser
- Multiple tabs support
- Keyboard shortcuts: `Ctrl/Cmd + T` (new tab), `Ctrl/Cmd + W` (close tab), `Ctrl/Cmd + Tab` (switch tabs)

### **2. Research Mode**
- **AI-Powered Search:** Ask questions and get comprehensive answers with citations
- **File Upload:** Upload PDF, DOCX, TXT, or MD files for document-based research
- **Knowledge Graph:** Visualize relationships between concepts
- **Notes & Highlights:** Save and organize your research findings

**Try it:**
1. Switch to Research mode (top navigation)
2. Upload a document or ask a research question
3. Watch as AI synthesizes answers from multiple sources
4. View citations and save findings to memory

### **3. Trade Mode**
- **AI Trading Signals:** Automatic buy/sell/hold recommendations every 30 seconds
- **Position Sizing Helper:** AI-powered position size calculations
- **Trading Charts:** Real-time market data visualization
- **Portfolio Management:** Track positions and risk metrics

**Try it:**
1. Switch to Trade mode
2. Search for a stock symbol (e.g., "AAPL")
3. View AI-generated trading signals with entry, stop loss, and take profit
4. Use the position sizing helper to optimize your trades

### **4. Game Mode**
- **AI Recommendations:** Personalized game suggestions based on your preferences
- **Enhanced Search:** Semantic search to find games you'll love
- **Save States:** Save and resume game progress
- **Cloud-Synced Library:** Access your games from anywhere

**Try it:**
1. Switch to Game mode
2. Click "AI Recommendations" to get personalized suggestions
3. Use enhanced search to find games by description or tags
4. Save your game progress with the save state feature

---

## ⌨️ **Keyboard Shortcuts**

### Tab Management
- `Ctrl/Cmd + T` - New tab
- `Ctrl/Cmd + W` - Close current tab
- `Ctrl/Cmd + Shift + T` - Reopen last closed tab
- `Ctrl/Cmd + Tab` - Next tab
- `Ctrl/Cmd + Shift + Tab` - Previous tab
- `Ctrl/Cmd + 1-9` - Switch to tab number

### Navigation
- `Ctrl/Cmd + L` - Focus address/search bar
- `Ctrl/Cmd + R` - Reload current page
- `Ctrl/Cmd + Shift + R` - Hard reload

### Modes
- Click mode buttons in top navigation (Browse, Research, Trade, Games)
- Each mode has its own tab set

---

## 🔍 **Address Bar Features**

### Smart Suggestions
The address bar provides:
- **History:** Recent searches and URLs
- **Open Tabs:** Quick access to open tabs
- **Commands:** Type `/g`, `/d`, `/r`, `/t` for quick mode switches
- **SuperMemory:** AI-powered suggestions from your saved memories

### Inline Autocomplete
- Type your query and see "ghost text" suggestions
- Press `Tab` to accept the suggestion
- Use `↑`/`↓` to cycle through suggestions
- Press `Enter` to search/navigate

---

## 🤖 **AI Features**

### Unified AI Engine
All AI features use the same engine:
- **Real-time Streaming:** Watch responses appear token-by-token
- **Multi-Provider Support:** Automatic fallback to OpenAI, Anthropic, or Ollama
- **Cost-Aware Routing:** Smart model selection based on cost tiers
- **Memory Context:** Personalized responses using your saved memories

### SuperMemory
- **Save to Memory:** Click "Save to Memory" on any AI response
- **Automatic Context:** Your memories are automatically included in future queries
- **Semantic Search:** Find relevant memories using AI-powered search

---

## ⚙️ **Settings**

### General
- **Startup Behavior:** Choose what happens on app launch
- **Default Search Engine:** Select your preferred search engine
- **Home Page:** Set a custom home page

### Privacy
- **Local-Only Mode:** Keep all data local (no cloud sync)
- **Clear Browsing Data:** Remove history, cache, and cookies
- **Session Restore:** Choose whether to restore tabs on restart

### Appearance
- **Theme:** Toggle between light and dark mode
- **Compact Mode:** Reduce spacing for a denser UI
- **Keyboard Shortcuts:** View all available shortcuts

---

## 📊 **Session Management**

### Session Snapshots
- **Automatic Saving:** Tabs and state are saved automatically
- **Restore Banner:** After restart, restore your previous session
- **Clear on Exit:** Option to clear data on app close

### Recently Closed Tabs
- **Reopen:** Press `Ctrl/Cmd + Shift + T` to reopen closed tabs
- **Stack:** Last 10 closed tabs are remembered

---

## 🧪 **Troubleshooting**

### App Won't Start
1. Check Node.js version: `node --version` (should be 20+)
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Clear cache: `rm -rf .cache dist dist-electron`

### AI Features Not Working
1. Check API keys in `.env` file
2. Verify API server is running: `npm run start:api`
3. Check console for error messages
4. Try a different provider (fallback is automatic)

### Performance Issues
1. Close unused tabs
2. Clear browsing data from Settings → Privacy
3. Disable extensions if any are installed
4. Check memory usage in task manager

### Build Errors
1. Check TypeScript errors: `npm run build:types`
2. Clear build cache: `rm -rf dist dist-electron node_modules/.vite`
3. Rebuild: `npm run build`

---

## 📚 **Additional Resources**

- [PROJECT_STATUS.md](../PROJECT_STATUS.md) - Current features and status
- [docs/TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) - Comprehensive testing guide
- [docs/BETA_RELEASE_CHECKLIST.md](./BETA_RELEASE_CHECKLIST.md) - Release readiness
- [SECURITY.md](../SECURITY.md) - Security documentation
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture details

---

## 🎯 **Next Steps**

1. **Explore Modes:** Try Research, Trade, and Game modes
2. **Configure Settings:** Customize the app to your preferences
3. **Save to Memory:** Start building your SuperMemory database
4. **Keyboard Shortcuts:** Learn the shortcuts to boost productivity

---

## 💡 **Tips**

- **Multi-Mode Workflows:** Use different modes for different tasks (Research for learning, Trade for investing, Games for entertainment)
- **Memory Building:** Save important findings to build a personalized knowledge base
- **AI Context:** The more you save to memory, the better AI responses become
- **Performance:** Close unused tabs to keep the app running smoothly

---

## 🆘 **Get Help**

- **Issues:** Report bugs or request features on GitHub
- **Documentation:** Check the docs folder for detailed guides
- **Community:** Join discussions (if applicable)

---

**Happy browsing!** 🚀

---

_Last updated: January 20, 2026_

