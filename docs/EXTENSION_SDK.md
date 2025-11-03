# OmniBrowser Extension SDK

Developer guide for creating browser extensions for OmniBrowser.

## Overview

OmniBrowser Extension SDK allows developers to extend browser functionality through JavaScript extensions that run in isolated contexts with controlled permissions.

## Architecture

- **Manifest**: JSON-based extension manifest (similar to Chrome Extension Manifest V3)
- **Runtime**: Sandboxed JavaScript execution
- **IPC Bridge**: Secure communication with main process
- **Permissions**: Fine-grained permission system
- **Storage**: Isolated storage per extension

## Extension Structure

```
my-extension/
├── manifest.json
├── background.js
├── content.js (optional)
├── popup.html (optional)
├── popup.js (optional)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Manifest

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "description": "Extension description",
  "permissions": [
    "tabs",
    "storage",
    "scripting"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ]
}
```

## Permissions

- `tabs`: Access to tab management
- `storage`: Local storage access
- `scripting`: Inject scripts into pages
- `downloads`: Download file access
- `history`: Browsing history access
- `bookmarks`: Bookmark management
- `notifications`: Show notifications
- `webRequest`: Intercept/modify network requests

## API Reference

### Tabs API

```javascript
// Get all tabs
const tabs = await chrome.tabs.query({});

// Create new tab
const tab = await chrome.tabs.create({ url: 'https://example.com' });

// Close tab
await chrome.tabs.remove(tabId);

// Update tab
await chrome.tabs.update(tabId, { url: 'https://example.com' });
```

### Storage API

```javascript
// Set value
await chrome.storage.local.set({ key: 'value' });

// Get value
const result = await chrome.storage.local.get('key');

// Remove value
await chrome.storage.local.remove('key');
```

### Scripting API

```javascript
// Execute script in tab
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    console.log('Hello from extension!');
  }
});
```

### IPC Bridge

```javascript
// Custom IPC communication
const result = await chrome.runtime.sendMessage({
  type: 'custom:action',
  data: { /* ... */ }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'custom:event') {
    // Handle message
    sendResponse({ success: true });
  }
});
```

## Extension Lifecycle

1. **Install**: Extension installed and registered
2. **Enable**: Extension activated
3. **Runtime**: Service worker runs in background
4. **Update**: Extension updated
5. **Uninstall**: Extension removed

## Security

- Extensions run in isolated contexts
- Permissions must be declared in manifest
- Content scripts can't access extension APIs directly
- IPC messages are validated

## Development

### Load Extension

1. Go to `chrome://extensions` (or equivalent)
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select extension directory

### Debugging

- Background script: Use DevTools service worker debugging
- Content script: Use DevTools in tab context
- Popup: Right-click extension icon → Inspect popup

### Testing

```bash
# Install extension SDK tools
npm install -g @omnibrowser/extension-cli

# Test extension
omnibrowser-extension test my-extension/

# Package extension
omnibrowser-extension package my-extension/
```

## Examples

### Basic Extension

```javascript
// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: 'https://example.com' });
});
```

### Content Script

```javascript
// content.js
document.body.style.backgroundColor = 'red';
```

### Popup Extension

```html
<!-- popup.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { width: 300px; padding: 10px; }
  </style>
</head>
<body>
  <h1>My Extension</h1>
  <button id="action">Click Me</button>
  <script src="popup.js"></script>
</body>
</html>
```

## Publishing

1. Package extension: `omnibrowser-extension package`
2. Submit to extension marketplace
3. Extension reviewed and published

## Resources

- [Extension API Reference](./EXTENSION_API.md)
- [Manifest Schema](./EXTENSION_MANIFEST.md)
- [Examples Repository](https://github.com/omnibrowser/extensions)

