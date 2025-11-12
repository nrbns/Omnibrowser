import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { fetchSources, summarizeWithCitations, verifyAnswer } from './research-enhanced';

export type ResearchStep =
  | { type: 'status'; value: string }
  | { type: 'chunk'; chunkId: string; content: string; citations: string[] }
  | { type: 'sources'; entries: Record<string, CiteEntry[]> }
  | { type: 'issues'; entries: ResearchIssue[] }
  | { type: 'complete' }
  | { type: 'error'; message: string };

export type CiteEntry = {
  id: string;
  title: string;
  url: string;
  publishedAt?: string;
  snippet?: string;
};

export type ResearchIssue = {
  type: 'uncited' | 'contradiction';
  sentenceIdx: number;
  detail?: string;
};

type ResearchJob = {
  id: string;
  question: string;
  windowId: number;
  mode?: 'default' | 'threat' | 'trade';
  listeners: Set<(step: ResearchStep) => void>;
  startedAt: number;
  aborted?: boolean;
};

class ResearchPipeline extends EventEmitter {
  private jobs = new Map<string, ResearchJob>();

  createJob(win: BrowserWindow, question: string, mode?: ResearchJob['mode']) {
    const id = randomUUID();
    const job: ResearchJob = {
      id,
      question,
      mode,
      windowId: win.id,
      listeners: new Set(),
      startedAt: Date.now(),
    };
    this.jobs.set(id, job);
    return job;
  }

  subscribe(jobId: string, listener: (step: ResearchStep) => void) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Research job not found');
    }
    job.listeners.add(listener);
    return () => job.listeners.delete(listener);
  }

  emitStep(jobId: string, step: ResearchStep) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }
    for (const listener of job.listeners.values()) {
      try {
        listener(step);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ResearchPipeline] Listener error:', error);
        }
      }
    }
  }

  async run(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Research job not found');
    }

    try {
      this.emitStep(jobId, { type: 'status', value: 'Gathering sources' });
      const sources = await fetchSources(job.question, { mode: job.mode });
      if (!sources || Object.keys(sources).length === 0) {
        this.emitStep(jobId, { type: 'error', message: 'No relevant sources found' });
        return;
      }
      this.emitStep(jobId, { type: 'sources', entries: sources });

      this.emitStep(jobId, { type: 'status', value: 'Drafting summary' });
      const summary = await summarizeWithCitations(job.question, sources);
      summary.chunks.forEach((chunk, idx) => {
        this.emitStep(jobId, {
          type: 'chunk',
          chunkId: `${jobId}-chunk-${idx}`,
          content: chunk.content,
          citations: chunk.citations,
        });
      });

      this.emitStep(jobId, { type: 'status', value: 'Verifying citations' });
      const issues = await verifyAnswer(summary, sources);
      if (issues.length > 0) {
        this.emitStep(jobId, { type: 'issues', entries: issues });
      }

      this.emitStep(jobId, { type: 'complete' });
    } catch (error) {
      this.emitStep(jobId, {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTimeout(() => {
        this.jobs.delete(jobId);
      }, 60_000);
    }
  }
}

const pipeline = new ResearchPipeline();

const ResearchStartSchema = z.object({
  question: z.string().min(3),
  mode: z.enum(['default', 'threat', 'trade']).optional(),
});

export function registerResearchPipelineIpc() {
  registerHandler('research:start', ResearchStartSchema, async (event, request) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      throw new Error('Unable to resolve window for research job');
    }

    const job = pipeline.createJob(win, request.question, request.mode);
    const channel = `research:stream:${job.id}`;

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

    if (process.env.PLAYWRIGHT === '1') {
      const emit = (step: ResearchStep, delay = 25) => {
        setTimeout(() => {
          pipeline.emitStep(job.id, step);
        }, delay);
      };

      const now = Date.now();
      const publishedAt = new Date(now - 1000 * 60 * 42).toISOString();
      emit({ type: 'status', value: 'Gathering sources' }, 25);
      emit(
        {
          type: 'sources',
          entries: {
            'cite-1': [
              {
                id: 'cite-1',
                title: 'Example Research Source',
                url: 'https://example.com/research',
                snippet: 'Quantum advances reported by leading labs.',
                publishedAt,
              },
            ],
          },
        },
        75,
      );
      emit({ type: 'status', value: 'Drafting summary' }, 110);
      emit(
        {
          type: 'chunk',
          chunkId: `${job.id}-chunk-1`,
          content: 'Quantum computing is trending rapidly across academia.',
          citations: ['cite-1'],
        },
        140,
      );
      emit(
        {
          type: 'status',
          value: 'Verifying citations',
        },
        170,
      );
      emit(
        {
          type: 'issues',
          entries: [
            {
              type: 'uncited',
              sentenceIdx: 0,
              detail: 'Ensure claims reference primary sources.',
            },
          ],
        },
        200,
      );
      emit({ type: 'complete' }, 240);
      setTimeout(() => {
        try {
          unsubscribe();
        } catch {}
        try {
          (pipeline as any)?.jobs?.delete?.(job.id);
        } catch {}
      }, 400);

      return { jobId: job.id, channel };
    }

    pipeline.run(job.id).catch((error) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[ResearchPipeline] run error:', error);
      }
    });

    return { jobId: job.id, channel };
  });
}

