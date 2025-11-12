# Release Checklist

Use this checklist when creating a new release.

## Pre-Release

- [ ] All tests pass (`npm run test:e2e`)
- [ ] Type checking passes (`npm run build:types`)
- [ ] Linting passes (`npm run lint`)
- [ ] CHANGELOG.md updated with new version section
- [ ] Version bumped in `package.json` (or let workflow do it)
- [ ] Release notes reviewed

## Creating the Release

### Option 1: Tag-based Release (Recommended)

1. Create and push a tag:
   ```bash
   git tag v0.1.0-alpha
   git push origin v0.1.0-alpha
   ```

2. GitHub Actions will automatically:
   - Extract version from tag
   - Build installers for all platforms
   - Create GitHub Release with artifacts
   - Extract release notes from CHANGELOG.md

### Option 2: Manual Workflow Dispatch

1. Go to **Actions** → **Release** workflow
2. Click **Run workflow**
3. Enter version (e.g., `v0.1.0-alpha`)
4. Select platform (`all`, `win`, `mac`, or `linux`)
5. Click **Run workflow**

## Post-Release Verification

- [ ] GitHub Release created at: `https://github.com/nrbns/Omnibrowser/releases/tag/v0.1.0-alpha`
- [ ] Windows installer (NSIS) downloadable
- [ ] macOS installer (DMG) downloadable
- [ ] Linux installer (AppImage) downloadable
- [ ] SHA256 checksums present (if configured)
- [ ] Release notes extracted correctly from CHANGELOG.md
- [ ] Artifacts are not corrupted (test download)

## Testing Installers

### Windows
- [ ] Installer runs without errors
- [ ] App launches after installation
- [ ] App appears in Start Menu
- [ ] Uninstaller works

### macOS
- [ ] DMG opens correctly
- [ ] App can be dragged to Applications
- [ ] App launches from Applications
- [ ] Gatekeeper warnings handled (if any)

### Linux
- [ ] AppImage is executable (`chmod +x`)
- [ ] AppImage runs on target distro
- [ ] Desktop integration works (if configured)

## Release Notes Template

When updating CHANGELOG.md, use this format:

```markdown
## [0.1.0-alpha] - 2025-01-XX

### Added
- Feature 1
- Feature 2

### Changed
- Change 1
- Change 2

### Fixed
- Bug fix 1
- Bug fix 2

### Security
- Security fix 1
```

## Troubleshooting

### Build fails on specific platform
- Check build logs in Actions artifacts
- Verify electron-builder configuration
- Test locally: `npm run build:app`

### Release notes not extracted
- Verify CHANGELOG.md format matches expected pattern
- Check workflow logs for extraction step
- Manual fallback: edit release notes in GitHub UI

### Artifacts missing
- Check artifact upload step in workflow
- Verify artifact retention settings
- Re-run workflow if needed

