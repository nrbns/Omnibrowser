import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { registerHandler } from '../../shared/ipc/router';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { fetchSources, type CiteEntry } from '../research-enhanced';

const logger = createLogger('live-search');

type LiveSearchMode = 'default' | 'threat' | 'trade';

type LiveSearchStep =
  | { type: 'status'; value: string }
  | { type: 'result'; index: number; total: number; result: LiveSearchResult }
  | { type: 'complete' }
  | { type: 'error'; message: string };

export type LiveSearchResult = {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  source?: string;
  score?: number;
  publishedAt?: string;
  domain?: string;
};

type LiveSearchJob = {
  id: string;
  query: string;
  mode?: LiveSearchMode;
  region?: string;
  maxResults: number;
  windowId: number;
  listeners: Set<(step: LiveSearchStep) => void>;
  startedAt: number;
};

class LiveSearchPipeline extends EventEmitter {
  private jobs = new Map<string, LiveSearchJob>();

  createJob(win: BrowserWindow, query: string, options?: { mode?: LiveSearchMode; region?: string; maxResults?: number }) {
    const id = randomUUID();
    const job: LiveSearchJob = {
      id,
      query,
      windowId: win.id,
      listeners: new Set(),
      startedAt: Date.now(),
      mode: options?.mode,
      region: options?.region,
      maxResults: options?.maxResults ?? 10,
    };
    this.jobs.set(id, job);
    return job;
  }

  subscribe(jobId: string, listener: (step: LiveSearchStep) => void) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Live search job not found');
    }
    job.listeners.add(listener);
    return () => job.listeners.delete(listener);
  }

  emitStep(jobId: string, step: LiveSearchStep) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }
    for (const listener of job.listeners.values()) {
      try {
        listener(step);
      } catch (error) {
        logger.warn('Live search listener error', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  async run(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Live search job not found');
    }

    try {
      this.emitStep(jobId, { type: 'status', value: 'Gathering sources' });
      const sources = await fetchSources(job.query, {
        mode: job.mode,
        maxSources: job.maxResults,
      });

      const entries: CiteEntry[] = [];
      for (const citeEntries of Object.values(sources)) {
        if (Array.isArray(citeEntries) && citeEntries.length > 0) {
          entries.push(citeEntries[0]);
        }
      }

      if (entries.length === 0) {
        this.emitStep(jobId, { type: 'error', message: 'No live results found' });
        return;
      }

      entries.sort((a, b) => {
        const scoreA = typeof a.relevanceScore === 'number' ? a.relevanceScore : 0;
        const scoreB = typeof b.relevanceScore === 'number' ? b.relevanceScore : 0;
        return scoreB - scoreA;
      });

      const total = Math.min(entries.length, job.maxResults);
      for (let index = 0; index < total; index += 1) {
        const entry = entries[index];
        this.emitStep(jobId, {
          type: 'result',
          index,
          total,
          result: {
            id: entry.id,
            title: entry.title || entry.url,
            url: entry.url,
            snippet: entry.snippet || entry.text?.slice(0, 160),
            source: entry.domain,
            score: entry.relevanceScore,
            publishedAt: entry.publishedAt,
            domain: entry.domain,
          },
        });
      }

      this.emitStep(jobId, { type: 'complete' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Live search run failed', { error: message });
      this.emitStep(jobId, { type: 'error', message });
    } finally {
      setTimeout(() => {
        this.jobs.delete(jobId);
      }, 30_000);
    }
  }
}

const pipeline = new LiveSearchPipeline();

const LiveSearchStartSchema = z.object({
  query: z.string().min(2),
  mode: z.enum(['default', 'threat', 'trade']).optional(),
  region: z.string().optional(),
  maxResults: z.number().int().min(3).max(20).optional(),
});

export function registerLiveSearchIpc() {
  registerHandler('search:live:start', LiveSearchStartSchema, async (event, request) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      throw new Error('Unable to resolve window for live search');
    }

    const job = pipeline.createJob(win, request.query, {
      mode: request.mode,
      region: request.region,
      maxResults: request.maxResults,
    });
    const channel = `search:live:${job.id}`;

    const unsubscribe = pipeline.subscribe(job.id, (step) => {
      if (win.isDestroyed()) {
        unsubscribe();
        return;
      }
      try {
        win.webContents.send(channel, step);
      } catch {
        unsubscribe();
      }
    });

    pipeline.run(job.id).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Live search pipeline error', { error: message });
    });

    return { jobId: job.id, channel };
  });
}
