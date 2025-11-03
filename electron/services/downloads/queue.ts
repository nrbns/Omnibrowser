/**
 * Download Queue - Parallel downloads with limits
 */

import PQueue from 'p-queue';
import { getYtDlpWrapper, DownloadOptions } from './ytdlp-wrapper';
import { EventEmitter } from 'node:events';

export interface QueuedDownload {
  id: string;
  url: string;
  options: DownloadOptions;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
  progress: number;
  filePath?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface QueueOptions {
  maxConcurrency?: number;
  maxRetries?: number;
}

export class DownloadQueue extends EventEmitter {
  private queue: PQueue;
  private downloads: Map<string, QueuedDownload> = new Map();
  private maxRetries: number;

  constructor(options: QueueOptions = {}) {
    super();
    this.queue = new PQueue({ 
      concurrency: options.maxConcurrency || 3,
    });
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Add download to queue
   */
  async addDownload(url: string, options: DownloadOptions): Promise<string> {
    const id = `download_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    const download: QueuedDownload = {
      id,
      url,
      options,
      status: 'queued',
      progress: 0,
    };

    this.downloads.set(id, download);
    this.emit('queued', download);

    // Start download
    this.queue.add(async () => {
      await this.processDownload(download);
    }).catch((error) => {
      download.status = 'failed';
      download.error = error.message;
      this.emit('failed', download);
    });

    return id;
  }

  /**
   * Process a download
   */
  private async processDownload(download: QueuedDownload): Promise<void> {
    download.status = 'downloading';
    download.startedAt = Date.now();
    this.emit('started', download);

    const ytdlp = getYtDlpWrapper();
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        const filePath = await ytdlp.download(
          {
            ...download.options,
            url: download.url,
          },
          (progress) => {
            download.progress = progress.percent;
            this.emit('progress', { ...download, progress: progress.percent });
          }
        );

        download.status = 'completed';
        download.filePath = filePath;
        download.progress = 100;
        download.completedAt = Date.now();
        this.emit('completed', download);
        return;
      } catch (error) {
        retries++;
        if (retries >= this.maxRetries) {
          download.status = 'failed';
          download.error = error instanceof Error ? error.message : String(error);
          this.emit('failed', download);
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  }

  /**
   * Get download status
   */
  getDownload(id: string): QueuedDownload | undefined {
    return this.downloads.get(id);
  }

  /**
   * Get all downloads
   */
  getAllDownloads(): QueuedDownload[] {
    return Array.from(this.downloads.values());
  }

  /**
   * Pause download (remove from queue)
   */
  pauseDownload(id: string): boolean {
    const download = this.downloads.get(id);
    if (download && download.status === 'queued') {
      download.status = 'paused';
      this.emit('paused', download);
      return true;
    }
    return false;
  }

  /**
   * Cancel download
   */
  cancelDownload(id: string): boolean {
    const download = this.downloads.get(id);
    if (download) {
      // Note: Cannot cancel in-progress downloads easily
      // Would need to kill the yt-dlp process
      if (download.status === 'queued' || download.status === 'paused') {
        this.downloads.delete(id);
        this.emit('cancelled', download);
        return true;
      }
    }
    return false;
  }

  /**
   * Get queue stats
   */
  getStats(): {
    total: number;
    queued: number;
    downloading: number;
    completed: number;
    failed: number;
  } {
    const downloads = Array.from(this.downloads.values());
    return {
      total: downloads.length,
      queued: downloads.filter(d => d.status === 'queued').length,
      downloading: downloads.filter(d => d.status === 'downloading').length,
      completed: downloads.filter(d => d.status === 'completed').length,
      failed: downloads.filter(d => d.status === 'failed').length,
    };
  }
}

// Singleton instance
let queueInstance: DownloadQueue | null = null;

export function getDownloadQueue(): DownloadQueue {
  if (!queueInstance) {
    queueInstance = new DownloadQueue();
  }
  return queueInstance;
}

