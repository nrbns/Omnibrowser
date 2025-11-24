// @ts-nocheck
/**
 * Renderer-side telemetry + Sentry helpers
 * Ensures crash reporting only runs when the user has opted in.
 */

import { ipc } from '../ipc-typed';
import { isElectronRuntime } from '../env';

const sentryState = {
  initialized: false,
  hasWarned: false,
};

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

/**
 * Electron-specific Sentry SDK is no longer bundled with the Tauri build.
 * We keep the previous public API so the rest of the app can continue
 * toggling telemetry opt-in without runtime errors.
 */
function logUnsupported(reason: string) {
  if (sentryState.hasWarned) return;
  console.info(
    `[Sentry] Renderer telemetry disabled (${reason}). ` +
      'Tauri builds intentionally exclude @sentry/electron. ' +
      'Configure a browser/Tauri-friendly SDK if telemetry is required.'
  );
  sentryState.hasWarned = true;
}

async function initRendererSentry() {
  if (!isElectronRuntime()) return;
  if (!SENTRY_DSN) {
    logUnsupported('missing DSN');
    return;
  }

  // We do not bundle the electron renderer SDK anymore but we keep this hook
  // so future desktop builds can swap in an implementation without touching callers.
  logUnsupported('electron runtime not available');
  sentryState.initialized = false;
}

async function shutdownRendererSentry() {
  if (!isElectronRuntime()) return;
  sentryState.initialized = false;
}

export async function applyTelemetryOptIn(optIn: boolean) {
  await ipc.telemetry.setOptIn(optIn);
  if (!isElectronRuntime()) return;

  if (optIn) {
    await initRendererSentry();
  } else {
    await shutdownRendererSentry();
  }
}

export async function syncRendererTelemetry() {
  if (!isElectronRuntime()) return;
  const status = await ipc.telemetry.getStatus();
  if (status.optIn) {
    await initRendererSentry();
  } else {
    await shutdownRendererSentry();
  }
}
