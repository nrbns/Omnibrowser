/**
 * yt-dlp Wrapper - Sandboxed execution for video/audio downloads
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const execAsync = promisify(exec);

export interface DownloadOptions {
  url: string;
  format?: string; // e.g., 'best', 'worst', 'bestvideo+bestaudio', etc.
  quality?: 'highest' | 'high' | 'medium' | 'low';
  extractAudio?: boolean;
  audioFormat?: 'mp3' | 'm4a' | 'opus' | 'vorbis' | 'wav';
  outputPath?: string;
}

export interface DownloadInfo {
  title: string;
  duration?: number;
  formats: Array<{
    formatId: string;
    ext: string;
    resolution?: string;
    filesize?: number;
    quality?: number;
  }>;
  thumbnail?: string;
  description?: string;
}

export class YtDlpWrapper {
  /**
   * Check if yt-dlp is available
   */
  async checkAvailable(): Promise<boolean> {
    try {
      await this.getCommand();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get yt-dlp command
   */
  private async getCommand(): Promise<string> {
    try {
      await execAsync('yt-dlp --version');
      return 'yt-dlp';
    } catch {
      // Try python module
      try {
        await execAsync('python -m yt_dlp --version');
        return 'python -m yt_dlp';
      } catch {
        throw new Error('yt-dlp not found. Install: pip install yt-dlp or download from https://github.com/yt-dlp/yt-dlp');
      }
    }
  }

  /**
   * Get video info without downloading
   */
  async getInfo(url: string): Promise<DownloadInfo> {
    const ytdlp = await this.getCommand();
    
    try {
      const { stdout } = await execAsync(`${ytdlp} "${url}" --dump-json --no-download`, {
        timeout: 15000,
      });

      const info = JSON.parse(stdout);

      return {
        title: info.title || 'Untitled',
        duration: info.duration,
        formats: (info.formats || []).map((f: any) => ({
          formatId: f.format_id,
          ext: f.ext,
          resolution: f.resolution,
          filesize: f.filesize,
          quality: f.quality,
        })),
        thumbnail: info.thumbnail,
        description: info.description,
      };
    } catch (error) {
      throw new Error(`Failed to get video info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Download video/audio
   */
  async download(options: DownloadOptions, onProgress?: (progress: { percent: number; speed?: string }) => void): Promise<string> {
    const ytdlp = await this.getCommand();
    const outputDir = options.outputPath || path.join(require('os').tmpdir(), 'omnibrowser-downloads');
    await fs.mkdir(outputDir, { recursive: true });

    // Build command
    let command = `${ytdlp} "${options.url}"`;
    
    // Format selection
    if (options.format) {
      command += ` -f "${options.format}"`;
    } else if (options.extractAudio) {
      command += ' -x';
      if (options.audioFormat) {
        command += ` --audio-format ${options.audioFormat}`;
      }
    } else {
      // Quality-based selection
      const qualityMap = {
        highest: 'bestvideo+bestaudio/best',
        high: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        medium: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
        low: 'worst',
      };
      command += ` -f "${qualityMap[options.quality || 'highest']}"`;
    }

    // Output template
    command += ` -o "${path.join(outputDir, '%(title)s.%(ext)s')}"`;

    try {
      // Execute with progress parsing
      const process = exec(command);
      let output = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
        // Parse progress if available
        if (onProgress) {
          const progressMatch = data.toString().match(/(\d+(?:\.\d+)?)%/);
          const speedMatch = data.toString().match(/([\d.]+(?:[KMGT]?i?B\/s))/);
          if (progressMatch) {
            onProgress({
              percent: parseFloat(progressMatch[1]),
              speed: speedMatch?.[1],
            });
          }
        }
      });

      process.stderr?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise<void>((resolve, reject) => {
        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`yt-dlp exited with code ${code}`));
          }
        });
      });

      // Parse output to find downloaded file
      const filenameMatch = output.match(/\[download\] Destination: (.+)/);
      if (filenameMatch) {
        return filenameMatch[1];
      }

      // Fallback: find most recent file in output dir
      const files = await fs.readdir(outputDir);
      const stats = await Promise.all(
        files.map(async (file) => ({
          file,
          stat: await fs.stat(path.join(outputDir, file)),
        }))
      );
      const mostRecent = stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0];
      
      return path.join(outputDir, mostRecent.file);
    } catch (error) {
      throw new Error(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Singleton instance
let ytdlpInstance: YtDlpWrapper | null = null;

export function getYtDlpWrapper(): YtDlpWrapper {
  if (!ytdlpInstance) {
    ytdlpInstance = new YtDlpWrapper();
  }
  return ytdlpInstance;
}

