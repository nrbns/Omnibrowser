import { BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { createLogger } from './utils/logger';
import { addDownloadRecord } from './storage';

const log = createLogger('video');

let consent = false;

export function registerVideoIpc(_win: BrowserWindow) {
  registerHandler('video:consent:get', z.object({}), async () => {
    return consent;
  });

  registerHandler(
    'video:consent:set',
    z.object({
      value: z.boolean(),
    }),
    async (_event, { value }) => {
      consent = value;
      return consent;
    }
  );

  registerHandler(
    'video:start',
    z.object({
      url: z.string().url(),
      format: z.string().optional(),
      outDir: z.string().optional(),
    }),
    async (event, { url, outDir }) => {
      try {
        if (!consent) {
          throw new Error('Consent required');
        }
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) {
          throw new Error('Window not available');
        }
        const outputDir = outDir || process.cwd();
        const id = Math.random().toString(36).slice(2);
        addDownloadRecord({ id, url, status: 'downloading', createdAt: Date.now() });
        const save = path.join(outputDir, `%(title)s.%(ext)s`);
        const proc = spawn('yt-dlp', ['-o', save, url], { shell: true });
        proc.stdout.on('data', d => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('video:progress', String(d));
          }
        });
        proc.stderr.on('data', d => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('video:progress', String(d));
          }
        });
        proc.on('close', code => {
          addDownloadRecord({
            id,
            url,
            status: code === 0 ? 'completed' : 'failed',
            createdAt: Date.now(),
          });
          if (win && !win.isDestroyed()) {
            win.webContents.send('downloads:updated');
          }
        });
        proc.on('error', error => {
          log.error('Video download process error', { error, id, url });
          addDownloadRecord({ id, url, status: 'failed', createdAt: Date.now() });
          if (win && !win.isDestroyed()) {
            win.webContents.send('downloads:updated');
          }
        });
        return { ok: true, id };
      } catch (error) {
        log.error('Failed to start video download', { error, url });
        throw new Error(
          `Failed to start video download: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  registerHandler('video:cancel', z.object({}), async () => {
    // TODO: Implement cancellation logic
    return true;
  });
}
