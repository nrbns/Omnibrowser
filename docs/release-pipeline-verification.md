# Release Pipeline Verification Guide

This guide helps verify that the release workflow (`.github/workflows/release.yml`) works correctly end-to-end.

## Prerequisites

- GitHub repository with Actions enabled
- `GITHUB_TOKEN` secret (automatically provided by GitHub Actions)
- Node.js 20+ installed locally (for local testing)
- Git configured with proper credentials

## Workflow Overview

The release workflow has three jobs:

1. **prepare**: Extracts version from tag, updates `package.json`
2. **build**: Builds Electron app for Windows, macOS, and Linux (matrix strategy)
3. **release**: Downloads artifacts, extracts CHANGELOG, creates GitHub Release

## Local Verification Steps

### 1. Verify electron-builder Configuration

```bash
# Check electron-builder config exists
cat electron-builder.yml

# Test local build (one platform)
npm run build
npx electron-builder --win --publish never

# Verify output directory
ls -la dist-release/
```

**Expected**: 
- `electron-builder.yml` exists
- Build completes without errors
- `dist-release/` contains installer files

### 2. Verify CHANGELOG Format

```bash
# Check CHANGELOG.md exists and has proper format
head -20 CHANGELOG.md

# Test extraction script (simulates workflow step)
VERSION="0.1.0-alpha"
TAG="v0.1.0-alpha"
if grep -qE "^## \[?$VERSION\]?" CHANGELOG.md; then
  awk "/^## \[?$VERSION\]?/,/^## /{if (!/^## \[?$VERSION\]?/ && /^## /) exit; print}" CHANGELOG.md > test-release-notes.md
  cat test-release-notes.md
fi
```

**Expected**: 
- CHANGELOG.md exists
- Contains version sections in format `## [0.1.0-alpha]` or `## 0.1.0-alpha`
- Extraction script produces valid release notes

### 3. Verify Version Extraction Logic

```bash
# Test version extraction (simulates workflow step)
TAG="v0.1.0-alpha"
VERSION="${TAG#v}"
echo "Tag: $TAG"
echo "Version: $VERSION"

# Should output:
# Tag: v0.1.0-alpha
# Version: 0.1.0-alpha
```

**Expected**: Version extraction works correctly for tags with/without `v` prefix

### 4. Verify package.json Version Update

```bash
# Test version update (dry run)
CURRENT_VERSION=$(node -p "require('./package.json').version")
TARGET_VERSION="0.1.0-alpha"
echo "Current: $CURRENT_VERSION"
echo "Target: $TARGET_VERSION"

if [ "$CURRENT_VERSION" != "$TARGET_VERSION" ]; then
  echo "Would update to $TARGET_VERSION"
else
  echo "Version already matches"
fi
```

**Expected**: Version comparison logic works correctly

## GitHub Actions Verification

### Option 1: Test with Manual Workflow Dispatch

1. Go to **Actions** → **Release** workflow
2. Click **Run workflow**
3. Enter version: `v0.1.0-alpha-test`
4. Select platform: `all` (or test one platform first)
5. Click **Run workflow**

**Verification Checklist**:
- [ ] Workflow starts successfully
- [ ] `prepare` job completes
- [ ] `build` jobs start for all platforms (or selected platform)
- [ ] Build jobs complete without errors
- [ ] Artifacts are uploaded
- [ ] `release` job creates GitHub Release (if all builds succeed)

### Option 2: Test with Tag Push

**⚠️ Warning**: This will create a real release. Use a test tag first.

```bash
# Create and push a test tag
git tag v0.1.0-alpha-test
git push origin v0.1.0-alpha-test

# Monitor workflow in GitHub Actions
# After completion, delete the test tag
git push origin --delete v0.1.0-alpha-test
git tag -d v0.1.0-alpha-test
```

**Verification Checklist**:
- [ ] Workflow triggers automatically on tag push
- [ ] All jobs complete successfully
- [ ] GitHub Release is created
- [ ] Installers are attached to release
- [ ] Release notes are extracted from CHANGELOG

## Post-Release Verification

After a release is created, verify:

### 1. GitHub Release

- [ ] Release exists at: `https://github.com/nrbns/Omnibrowser/releases/tag/v0.1.0-alpha`
- [ ] Release name is correct: `Release 0.1.0-alpha`
- [ ] Release notes are present and correctly formatted
- [ ] Release is marked as pre-release (for alpha/beta/rc versions)

### 2. Artifacts

- [ ] Windows installer (`.exe` or `.msi`) is present
- [ ] macOS installer (`.dmg` or `.pkg`) is present
- [ ] Linux installer (`.AppImage` or `.deb`/`.rpm`) is present
- [ ] Artifacts are downloadable
- [ ] File sizes are reasonable (not 0 bytes or corrupted)

### 3. Installer Functionality

**Windows**:
- [ ] Installer runs without errors
- [ ] App installs to correct location
- [ ] App launches after installation
- [ ] App appears in Start Menu
- [ ] Uninstaller works

**macOS**:
- [ ] DMG opens correctly
- [ ] App can be dragged to Applications
- [ ] App launches from Applications
- [ ] Gatekeeper warnings handled (if any)

**Linux**:
- [ ] AppImage is executable (`chmod +x`)
- [ ] AppImage runs on target distro
- [ ] Desktop integration works (if configured)

## Common Issues & Fixes

### Issue: Build fails with "electron-builder: command not found"

**Fix**: Ensure `electron-builder` is in `package.json` dependencies or devDependencies

### Issue: Artifacts not found in release

**Fix**: Check artifact upload paths in workflow. Verify `dist-release/` directory structure matches expected paths.

### Issue: CHANGELOG extraction fails

**Fix**: 
- Verify CHANGELOG.md format matches expected pattern
- Check version format in CHANGELOG (should match tag version)
- Test extraction script locally

### Issue: Version update fails

**Fix**: 
- Ensure git credentials are configured in workflow
- Check that `package.json` is writable
- Verify version format is valid semver

### Issue: Release creation fails with permissions error

**Fix**: 
- Ensure `GITHUB_TOKEN` has `contents: write` permission
- Check repository settings → Actions → General → Workflow permissions

## Automated Testing Script

Create a local test script to verify workflow steps:

```bash
#!/bin/bash
# scripts/test-release-workflow.sh

set -e

echo "Testing Release Workflow Components..."

# Test 1: Version extraction
TAG="v0.1.0-alpha"
VERSION="${TAG#v}"
if [ "$VERSION" != "0.1.0-alpha" ]; then
  echo "❌ Version extraction failed"
  exit 1
fi
echo "✅ Version extraction works"

# Test 2: CHANGELOG extraction
if [ -f CHANGELOG.md ]; then
  if grep -qE "^## \[?$VERSION\]?" CHANGELOG.md; then
    echo "✅ CHANGELOG format valid"
  else
    echo "⚠️  CHANGELOG format may not match version pattern"
  fi
else
  echo "⚠️  CHANGELOG.md not found"
fi

# Test 3: package.json version check
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "✅ Current version: $CURRENT_VERSION"

# Test 4: electron-builder config
if [ -f electron-builder.yml ]; then
  echo "✅ electron-builder.yml exists"
else
  echo "❌ electron-builder.yml not found"
  exit 1
fi

echo "✅ All local checks passed"
```

## Next Steps

After verification:

1. **First Release**: Create tag `v0.1.0-alpha` and push to trigger workflow
2. **Monitor**: Watch GitHub Actions for any failures
3. **Test Installers**: Download and test installers on each platform
4. **Document Issues**: Update this guide with any issues encountered

## Related Files

- `.github/workflows/release.yml` - Release workflow definition
- `electron-builder.yml` - Electron builder configuration
- `CHANGELOG.md` - Release notes source
- `package.json` - Version and build scripts
- `docs/release-checklist.md` - Manual release checklist

