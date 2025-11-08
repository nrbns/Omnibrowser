---
title: OmniBrowser User Guide
description: How to work with Research Mode, Document Review, and Container Profiles.
---

# OmniBrowser User Guide

Welcome! This guide walks you through the three core workflows that make OmniBrowser unique:

1. **Research Mode** – aggregate evidence, produce answers with citations, and monitor contradictions.
2. **Document Review Mode** – ingest reports/contracts and surface highlights, assumptions, and audit trails.
3. **Container Profiles (“Containers++”)** – isolate workspaces, permissions, and storage between contexts.

Each section covers common tasks, real-time features, and tips for getting the most out of the UI.

---

## 1. Research Mode

### Launching a session
1. Open the mode switcher in the top navigation bar and choose **Research**.
2. Use the large query box to enter any question or comparison prompt  
   e.g. `Compare claims about Mediterranean diet heart benefits`.
3. Optional controls:
   - **Recency vs Authority** slider balances fresh sources against high-trust domains.
   - **Include counterpoints** surfaces deliberate disagreements.
   - **Region** scopes results to a geography (Global by default).
4. Click **Run research** or press <kbd>Enter</kbd>.

### Reading the answer
- The answer card highlights key paragraphs with inline citations and confidence scores.
- Click a citation badge (`[1]`, `[2]`, etc.) to preview the source in the sidebar or open it in your active tab.
- Hover states show container-color badges (e.g., Work, Personal) so you know which partition will open the link.

### Evidence and contradictions
- **Live-page evidence** lists text snippets with “View on page” buttons that jump to anchored fragments.
- **Contradictions radar** groups conflicting claims and lets you open the sources that disagree.
- The right sidebar mirrors confidence, top evidence, bias snapshot, and follow-up tasks.

### Tips & shortcuts
- Press <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> and type “Open … in Work” to send any query directly into a container.
- Use the **Task chains** section to keep track of manually verified steps (mark tasks done as you complete them).

---

## 2. Document Review Mode

### Ingesting documents
1. Switch to **Docs** via the mode selector.
2. Choose **Upload / Paste URL** on the left sidebar:
   - Upload PDF/DOCX files.
   - Paste a public URL (OmniBrowser fetches via stealth container to avoid contaminating your main session).
3. Provide an optional title/tag for quick retrieval, then click **Ingest**.

### Reviewing insights
- The middle pane shows the structured document with inline highlights:
  - **Fact highlights** (color-coded) for claims worth attention.
  - **Assumptions** list implicit statements the system detected.
  - **Entity graph** visualizes actors, organizations, relationships.
  - **Timeline** gives chronological markers with quick jump links.
- Hover over highlights to reveal AI annotations; click to anchor the original location.

### Audit trail & actions
- The right panel records sources pulled, checks performed, and suggestions (e.g., “Confirm balance sheet totals against appendix”).
- Use **Export** menu (top right) to generate Markdown, JSON, or send structured summaries to Notion/Obsidian.
- If you need to re-run a check under a different container, choose **Move to container** from the tab context menu before opening external links.

### Best practices
- Keep sensitive contracts in a dedicated **Container** (e.g., “Legal”) to isolate cookies and storage.
- Track review progress by marking checklist items directly in the audit trail.

---

## 3. Container Profiles (Containers++)

### Understanding containers
- Containers isolate cookies, local storage, permissions, and fingerprinting signals.
- Built-in profiles: **Default**, **Work**, **Personal**, **Stealth** (ephemeral).
- Custom containers can be created via the **Container switcher**.

### Managing containers
1. Open the switcher in the top nav and pick a container or create a new one.
2. Configure per-container permissions (camera, screen capture, notifications, fullscreen).
3. Review granted origins—remove or revoke site-specific permissions as needed.

### Assigning tabs to containers
- Right-click any tab to open the context menu and choose **Move to container** → target profile.
- Tabs adopt the new partition and storage immediately; the UI highlights the active container badge.
- Duplicate tabs, open in ghost/private, or burn tabs from the same menu (actions obey profile policies).

### Privacy tips
- Run AI research in **Stealth** or a bespoke “AI Research” container to avoid polluting main sessions.
- Use different containers for vendor portals vs. personal accounts to prevent cookie leakage.
- Policies at the profile level can disable downloads, screenshots, ghost/private tabs, or clipping where required.

---

## 4. Frequently Asked Questions

### How do I trust the citations?
- Every sentence in Research Mode links to its supporting source. Click the badge to jump to the exact evidence (using text fragments when available).
- The **Verification summary** lists ungrounded claims and hallucination risk so you can escalate manual checks if needed.

### Can I export my findings?
- **Research Mode**: use the sidebar’s **Copy answer** button or export markdown via the command palette (`Export research` command).
- **Document Review**: exports include Markdown, JSON, and Notion/Obsidian integrations.

### How do I recover a session after a crash?
- OmniBrowser autosaves every 2 seconds and stores full window/tab state. Choose **Session bundles** or the session switcher to restore a snapshot.

---

## 5. Quick Reference

| Action | Shortcut / Location |
| --- | --- |
| Open Command Palette | <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Move tab to container | Tab context menu → “Move to container” |
| Toggle Research counterpoints | Research controls (top of answer pane) |
| Ingest new document | Docs mode sidebar → “Upload / Paste URL” |
| Export research summary | Command palette (`Export research`) or copy button |

---

Need deeper workflow help or want to contribute improvements? Reach out via the project README or open an issue in the OmniBrowser repo. Happy researching! 👋


