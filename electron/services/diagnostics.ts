import { app, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { getCurrentSettings } from './storage';

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_LOG_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const LOG_FILENAME = 'omnibrowser.log';

let logDir: string;
let logFilePath: string;
let logSize = 0;
let logBirth = Date.now();
let writeQueue: Promise<void> = Promise.resolve();
let initialized = false;

type ConsoleLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface ConsoleOriginals {
  log: typeof console.log;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
  debug: typeof console.debug;
}

const originals: ConsoleOriginals = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

async function ensureLogEnvironment() {
  if (initialized) return;
  logDir = path.join(app.getPath('userData'), 'logs');
  logFilePath = path.join(logDir, LOG_FILENAME);
  await fs.mkdir(logDir, { recursive: true });
  try {
    const stat = await fs.stat(logFilePath);
    logSize = stat.size;
    logBirth = stat.birthtimeMs || stat.mtimeMs || Date.now();
  } catch {
    await fs.writeFile(logFilePath, '');
    logSize = 0;
    logBirth = Date.now();
  }
  initialized = true;
}

async function rotateLogIfNeeded(increment: number) {
  if (logSize + increment <= MAX_LOG_SIZE && Date.now() - logBirth <= MAX_LOG_AGE_MS) {
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rotatedName = `omnibrowser-${stamp}.log`;
  try {
    await fs.rename(logFilePath, path.join(logDir, rotatedName));
  } catch {
    // Ignore rename errors
  }
  await fs.writeFile(logFilePath, '');
  logSize = 0;
  logBirth = Date.now();
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.stack || arg.message}`;
  }
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function enqueueWrite(level: ConsoleLevel, args: unknown[]) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${args.map(formatArg).join(' ')}${os.EOL}`;
  const bytes = Buffer.byteLength(line);
  writeQueue = writeQueue
    .then(async () => {
      await ensureLogEnvironment();
      await rotateLogIfNeeded(bytes);
      await fs.appendFile(logFilePath, line);
      logSize += bytes;
    })
    .catch((error) => {
      originals.error('[Diagnostics] Failed to write to log file', error);
    });
}

function patchConsole() {
  console.log = (...args: unknown[]) => {
    enqueueWrite('INFO', args);
    originals.log(...args);
  };
  console.info = (...args: unknown[]) => {
    enqueueWrite('INFO', args);
    originals.info(...args);
  };
  console.warn = (...args: unknown[]) => {
    enqueueWrite('WARN', args);
    originals.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    enqueueWrite('ERROR', args);
    originals.error(...args);
  };
  console.debug = (...args: unknown[]) => {
    enqueueWrite('DEBUG', args);
    originals.debug(...args);
  };

  process.on('uncaughtException', (error) => {
    enqueueWrite('ERROR', ['Uncaught exception:', error]);
  });

  process.on('unhandledRejection', (reason) => {
    enqueueWrite('ERROR', ['Unhandled rejection:', reason]);
  });
}

async function tailLog(lines = 200): Promise<string> {
  try {
    await ensureLogEnvironment();
    const content = await fs.readFile(logFilePath, 'utf-8');
    const entries = content.split(/\r?\n/);
    return entries.slice(-lines).join(os.EOL);
  } catch (error) {
    return `Unable to read log: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function buildDiagnosticsSummary(logTail: string): string {
  const settings = getCurrentSettings();
  const telemetryOptIn = settings.diagnostics?.telemetryOptIn ? 'Enabled' : 'Disabled';
  return [
    `OmniBrowser ${app.getVersion()}`,
    `Electron ${process.versions.electron}`,
    `Chromium ${process.versions.chrome}`,
    `Node ${process.versions.node}`,
    `Platform ${os.type()} ${os.release()} (${os.arch()})`,
    `Telemetry opt-in: ${telemetryOptIn}`,
    `Logs directory: ${logDir}`,
    '',
    '--- Recent log tail ---',
    logTail,
  ].join(os.EOL);
}

export function initializeDiagnostics(): void {
  ensureLogEnvironment().catch((error) => {
    originals.error('[Diagnostics] Failed to initialize log environment', error);
  });
  patchConsole();
  console.info('[Diagnostics] Logging initialized at', logDir);
}

export function registerDiagnosticsIpc(): void {
  registerHandler('diagnostics:openLogs', z.object({}), async () => {
    await ensureLogEnvironment();
    const result = await shell.openPath(logDir);
    return { success: result === '' };
  });

  registerHandler('diagnostics:copy', z.object({}), async () => {
    const tail = await tailLog();
    const summary = buildDiagnosticsSummary(tail);
    return { diagnostics: summary };
  });
}


