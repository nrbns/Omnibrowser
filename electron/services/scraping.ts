import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { createLogger } from './utils/logger';

const log = createLogger('scraping');

type Task = { id: string; url: string };
const tasks = new Map<string, Task>();

export function registerScrapingIpc() {
  registerHandler(
    'scrape:enqueue',
    z.object({
      url: z.string().url(),
    }),
    async (_event, { url }) => {
      try {
        const id = randomUUID();
        tasks.set(id, { id, url });
        const file = path.join(app.getPath('userData'), 'tmp');
        fs.mkdirSync(file, { recursive: true });
        const img = path.join(file, `${id}.png`);
        fs.writeFileSync(img, Buffer.alloc(0));
        return {
          id,
          html: '<html></html>',
          text: '',
          screenshotPath: img,
          warning: 'Playwright not installed; returning mock.',
        };
      } catch (error) {
        log.error('Failed to enqueue scrape task', { error, url });
        throw new Error(
          `Failed to enqueue scrape: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  registerHandler(
    'scrape:get',
    z.object({
      id: z.string(),
    }),
    async (_event, { id }) => {
      try {
        return tasks.get(id) ?? null;
      } catch (error) {
        log.error('Failed to get scrape task', { error, id });
        throw new Error(
          `Failed to get scrape task: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}
