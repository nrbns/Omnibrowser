# CI Debugging Guide

## Current CI Status

The CI pipeline is failing on the **Build Test** step. This guide helps diagnose and fix the issue.

## How to Debug

### Step 1: Check Build Logs

When CI fails, look at the "Build Test" job logs. The enhanced diagnostics will show:

- Full build output
- Error patterns detected
- File existence checks
- Environment information

### Step 2: Common Issues and Fixes

#### Issue: "Cannot find module"

- **Cause:** Missing dependency or import path issue
- **Fix:** Check `package.json` dependencies, verify import paths

#### Issue: TypeScript errors

- **Cause:** Type errors in source code
- **Fix:** Run `npm run build:types` locally, fix reported errors

#### Issue: "ENOENT" (file not found)

- **Cause:** Missing file or wrong path
- **Fix:** Verify file paths in imports, check file existence

#### Issue: Build succeeds but `dist-web` not found

- **Cause:** Output directory mismatch
- **Fix:** Check `vite.config.ts` `outDir` setting

### Step 3: Local Testing

Before pushing to CI, always test locally:

```bash
# Clean build
npm run clean
npm ci --legacy-peer-deps

# Type check
npm run build:types

# Build
npm run build

# Verify output
ls -la dist-web/
```

### Step 4: CI Environment Differences

CI runs on Ubuntu Linux, so watch for:

- Case-sensitive file paths (Linux vs Windows)
- Line ending differences (LF vs CRLF)
- Environment variables missing
- Different Node/npm versions

## Current Build Configuration

- **Build command:** `npm run build` (uses `cross-env JSDOM_NO_CANVAS=1 vite build`)
- **Output directory:** `dist-web/` (set in `vite.config.ts`)
- **TypeScript check:** `npm run build:types` (uses `tsc -b`)

## Next Steps

1. **Check the actual build logs** from the failed CI run
2. **Look for specific error messages** in the build output
3. **Fix the root cause** (missing file, type error, etc.)
4. **Test locally** before pushing again

## Enhanced Diagnostics

The CI workflow now includes:

- ✅ Pre-build file checks
- ✅ Full build output capture
- ✅ Error pattern detection
- ✅ Comprehensive error reporting
- ✅ Better TypeScript error display

All errors will be clearly displayed in the CI logs.
