# Continuous Integration Checklist

This document captures the minimum checks we expect every pull request to pass before tagging `v0.2.0-beta`.

## npm scripts

| Command | Purpose |
|---------|---------|
| `npm run build:types` | Strict TypeScript project references build. Fails if any TypeScript errors are present. |
| `npm run lint` | Lints the entire repo with ESLint. |
| `npm run audit:prod` | Runs `npm audit --omit=dev` to surface production dependency vulnerabilities. |
| `npm run ci:check` | Convenience script that runs the three commands above in sequence. |

> `npm test` currently returns success because no unit tests exist yet. Once test coverage lands, wire the test runner into `ci:check`.

## GitHub Actions workflow

We added `.github/workflows/ci.yml` which:

1. Checks out the repo on `ubuntu-latest`.
2. Uses Node.js 20 with npm caching.
3. Runs `npm ci`.
4. Executes `npm run build:types`, `npm run lint`, `npm run audit:prod`, and finally `npm run build`.

The workflow triggers on pushes to `main`/`develop` and on every pull request. Adjust the branch filters if your default branch naming differs.

## Local pre-flight

Before opening a PR:

```bash
npm ci
npm run ci:check
npm run build  # optional but recommended for catching Vite bundling issues
```

## Future enhancements

- Replace the placeholder `npm test` with real unit/integration suites.
- Add artifact uploads (renderer bundle, electron main bundle) once signed builds are ready.
- Gate packaging (`npm run build:app`) behind a manual approval once code-signing certificates are configured.

