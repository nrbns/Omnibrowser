// @ts-nocheck
/**
 * Sentry Crash Reporting (Opt-In Only)
 * Provides privacy-aware crash reporting for both main and renderer processes.
 */

import { app } from 'electron';
import { createLogger } from '../utils/logger';

let sentryMain: typeof import('@sentry/electron/main') | null = null;
let initialized = false;

const logger = createLogger('sentry');
const SENTRY_DSN = process.env.SENTRY_DSN || process.env.SENTRY_DSN_MAIN;
const SENTRY_TRACES_SAMPLE_RATE = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0');

function scrubBreadcrumb(breadcrumb: any) {
  if (!breadcrumb || typeof breadcrumb !== 'object') return breadcrumb;
  const clone = { ...breadcrumb };
  if (clone.data) {
    const data = { ...clone.data };
    if (typeof data.url === 'string') {
      try {
        const url = new URL(data.url);
        data.url = `${url.protocol}//${url.hostname}`;
      } catch {
        delete data.url;
      }
    }
    if (typeof data.request === 'object' && data.request?.url) {
      try {
        const url = new URL(data.request.url);
        data.request.url = `${url.protocol}//${url.hostname}`;
      } catch {
        delete data.request.url;
      }
    }
    clone.data = data;
  }
  return clone;
}

function scrubEvent(event: any) {
  if (!event || typeof event !== 'object') return event;

  // Remove user info entirely (we never capture PII)
  if (event.user) {
    delete event.user;
  }

  if (event.request?.url) {
    try {
      const url = new URL(event.request.url);
      event.request.url = `${url.protocol}//${url.hostname}`;
    } catch {
      delete event.request.url;
    }
  }

  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }

  return event;
}

export function enableCrashReporting() {
  if (initialized || !SENTRY_DSN) {
    if (!SENTRY_DSN) {
      logger.info('Sentry disabled - missing SENTRY_DSN environment variable');
    }
    return;
  }

  try {
    sentryMain = require('@sentry/electron/main');
  } catch (error) {
    logger.warn('Sentry package not available', { error });
    return;
  }

  try {
    sentryMain.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: `${app.getName()}@${app.getVersion()}`,
      tracesSampleRate: Number.isFinite(SENTRY_TRACES_SAMPLE_RATE) ? SENTRY_TRACES_SAMPLE_RATE : 0,
      autoSessionTracking: false,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
      normalizeDepth: 5,
      initialScope: {
        tags: {
          channel: process.env.OB_CHANNEL || 'desktop',
        },
      },
    });
    initialized = true;
    logger.info('Sentry crash reporting enabled');
  } catch (error) {
    logger.error('Failed to initialize Sentry', { error });
  }
}

export async function disableCrashReporting() {
  if (!initialized || !sentryMain) return;
  try {
    await sentryMain.close(2000);
    initialized = false;
    logger.info('Sentry crash reporting disabled');
  } catch (error) {
    logger.warn('Failed to shutdown Sentry cleanly', { error });
  }
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  if (!initialized || !sentryMain) return;
  try {
    sentryMain.captureException(error, context ? { extra: context } : undefined);
  } catch (captureError) {
    logger.warn('Failed to capture exception with Sentry', { captureError });
  }
}


