# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

1. **Do NOT** open a public issue
2. Email security concerns to: [security@omnibrowser.dev] (placeholder)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to resolve the issue.

## Security Features

### Privacy & Data Protection
- **Private Mode**: In-memory partitions, no data persistence
- **Burn Tab**: Instant data clearing per tab
- **Panic Wipe**: Emergency data clearing
- **Forensic Cleanse**: Deep cache clearing

### Consent & Permissions
- **Consent Ledger**: All sensitive operations require explicit consent
- **Permission Prompts**: Camera, microphone, filesystem access
- **Download Consent**: Gated downloads with user approval

### Network Security
- **Tor Integration**: Anonymous routing
- **Shields**: Ad/tracker blocking, HTTPS upgrades
- **DNS-over-HTTPS**: Encrypted DNS queries
- **WebRTC Leak Protection**: Blocks WebRTC IP leaks

### Code Security
- **Context Isolation**: Renderer process isolation
- **Sandboxing**: BrowserViews run in sandbox
- **Content Security Policy**: CSP headers enforced
- **Input Validation**: All IPC requests validated with Zod schemas

## Best Practices

1. Always validate user input
2. Use typed IPC handlers (never raw `ipcMain.handle`)
3. Never store sensitive data in plain text
4. Use secure storage for secrets (keytar)
5. Clear sensitive data when no longer needed

