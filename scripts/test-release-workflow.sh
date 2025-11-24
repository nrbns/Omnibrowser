#!/bin/bash
# Test Release Workflow Components
# This script verifies that release workflow steps will work correctly

set -e

echo "🧪 Testing Release Workflow Components..."
echo ""

# Test 1: Version extraction
echo "1. Testing version extraction..."
TAG="v0.1.0-alpha"
VERSION="${TAG#v}"
if [ "$VERSION" != "0.1.0-alpha" ]; then
  echo "   ❌ Version extraction failed: got '$VERSION', expected '0.1.0-alpha'"
  exit 1
fi
echo "   ✅ Version extraction works: $TAG → $VERSION"

# Test 2: CHANGELOG format
echo ""
echo "2. Testing CHANGELOG format..."
if [ -f CHANGELOG.md ]; then
  if grep -qE "^## \[?$VERSION\]?" CHANGELOG.md || grep -q "## \[Unreleased\]" CHANGELOG.md; then
    echo "   ✅ CHANGELOG format is valid"
  else
    echo "   ⚠️  CHANGELOG format may not match version pattern for $VERSION"
    echo "   💡 Add a section: ## [$VERSION] or ## [Unreleased]"
  fi
else
  echo "   ⚠️  CHANGELOG.md not found (workflow will create fallback notes)"
fi

# Test 3: package.json version
echo ""
echo "3. Checking package.json version..."
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "   📦 Current version: $CURRENT_VERSION"
if [ "$CURRENT_VERSION" = "$VERSION" ]; then
  echo "   ✅ Version matches target"
else
  echo "   ℹ️  Version will be updated from $CURRENT_VERSION to $VERSION during release"
fi

# Test 4: Tauri CLI availability
echo ""
echo "4. Checking Tauri CLI..."
if command -v npx &> /dev/null; then
  if npx tauri --version &> /dev/null; then
    TAURI_VERSION=$(npx tauri --version 2>/dev/null || echo "unknown")
    echo "   ✅ Tauri CLI available: $TAURI_VERSION"
  else
    echo "   ⚠️  Tauri CLI not found (install @tauri-apps/cli for desktop builds)"
  fi
else
  echo "   ⚠️  npx not available (should be fine in CI)"
fi

# Test 5: Build script
echo ""
echo "5. Checking build scripts..."
if grep -q '"build":' package.json; then
  echo "   ✅ 'build' script exists"
else
  echo "   ❌ 'build' script not found in package.json"
  exit 1
fi

if grep -q '"build:app":' package.json; then
  echo "   ✅ 'build:app' script exists (delegates to Tauri workspace)"
else
  echo "   ⚠️  'build:app' script not found (workflow expects 'npm run build && npm run build:app')"
fi

# Test 6: Output directory check
echo ""
echo "6. Checking output directory configuration..."
if [ -d "dist" ]; then
  echo "   ✅ 'dist' directory exists (Vite output)"
else
  echo "   ℹ️  'dist' directory will be created during build"
fi

# Test 7: Release workflow file
echo ""
echo "7. Checking release workflow..."
if [ -f ".github/workflows/release.yml" ]; then
  echo "   ✅ Release workflow file exists"
  
  # Check for critical steps
  if grep -q "Extract version" .github/workflows/release.yml; then
    echo "   ✅ Version extraction step found"
  fi
  
  if grep -q -i "Build Tauri" .github/workflows/release.yml; then
    echo "   ✅ Tauri build step found"
  fi
  
  if grep -q "Create GitHub Release" .github/workflows/release.yml; then
    echo "   ✅ Release creation step found"
  fi
else
  echo "   ❌ Release workflow file not found"
  exit 1
fi

echo ""
echo "✅ All local checks passed!"
echo ""
echo "📋 Next steps:"
echo "   1. Review release workflow: .github/workflows/release.yml"
echo "   2. Test with manual workflow dispatch in GitHub Actions"
echo "   3. Or create a test tag: git tag v0.1.0-alpha-test && git push origin v0.1.0-alpha-test"
echo ""

