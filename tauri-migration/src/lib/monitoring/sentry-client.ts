// @ts-nocheck
/**
 * Renderer-side telemetry + Sentry helpers
 * Ensures crash reporting only runs when the user has opted in.
 */

import { ipc } from '../ipc-typed';
import { isDesktopRuntime } from '../env';

const SENTRY_BROWSER_MODULE_ID = '@sentry/browser';
let browserSentry: typeof import('@sentry/browser') | null = null;
let sentryInitialized = false;

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const SENTRY_ENV = import.meta.env.MODE || process.env.NODE_ENV || 'development';
const SENTRY_SAMPLE_RATE = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0');
const RELEASE = import.meta.env.VITE_APP_VERSION || '0.0.0';

async function initRendererSentry() {
  if (!isDesktopRuntime()) return;
  if (sentryInitialized) return;
  if (!SENTRY_DSN) return;

  if (!browserSentry) {
    try {
      browserSentry = await import(/* @vite-ignore */ SENTRY_BROWSER_MODULE_ID);
    } catch (error) {
      console.warn('[Sentry] Browser SDK unavailable', error);
      return;
    }
  }

  try {
    browserSentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENV,
      release: `omnibrowser-desktop@${RELEASE}`,
      enableUnresponsive: false,
      tracesSampleRate: Number.isFinite(SENTRY_SAMPLE_RATE) ? SENTRY_SAMPLE_RATE : 0,
      beforeSend(event) {
        if (event?.request?.url) {
          try {
            const url = new URL(event.request.url);
            event.request.url = `${url.protocol}//${url.hostname}`;
          } catch {
            delete event.request.url;
          }
        }
        if (event?.user) {
          delete event.user;
        }
        return event;
      },
    });
    sentryInitialized = true;
    console.info('[Sentry] Desktop telemetry enabled');
  } catch (error) {
    console.warn('[Sentry] Failed to initialize browser SDK', error);
  }
}

async function shutdownRendererSentry() {
  if (!browserSentry || !sentryInitialized) return;
  try {
    await browserSentry.close?.(2000);
  } catch (error) {
    console.warn('[Sentry] Failed to shutdown browser SDK', error);
  }
  sentryInitialized = false;
}

export async function applyTelemetryOptIn(optIn: boolean) {
  await ipc.telemetry.setOptIn(optIn);
  if (!isDesktopRuntime()) return;

  if (optIn) {
    await initRendererSentry();
  } else {
    await shutdownRendererSentry();
  }
}

export async function syncRendererTelemetry() {
  if (!isDesktopRuntime()) return;
  const status = await ipc.telemetry.getStatus();
  if (status.optIn) {
    await initRendererSentry();
  } else {
    await shutdownRendererSentry();
  }
}
