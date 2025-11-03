/**
 * Format Selector - Choose video/audio quality and format
 */

import { getYtDlpWrapper, DownloadInfo } from './ytdlp-wrapper';

export interface FormatSelection {
  formatId?: string;
  format?: string;
  quality?: 'highest' | 'high' | 'medium' | 'low';
  extractAudio?: boolean;
  audioFormat?: 'mp3' | 'm4a' | 'opus' | 'vorbis' | 'wav';
}

export class FormatSelector {
  /**
   * Recommend format based on quality preference
   */
  recommendFormat(info: DownloadInfo, selection: FormatSelection): string {
    if (selection.formatId) {
      return selection.formatId;
    }

    if (selection.extractAudio) {
      // Audio-only
      return 'bestaudio/best';
    }

    if (selection.format) {
      return selection.format;
    }

    // Quality-based
    const quality = selection.quality || 'high';
    const formats = info.formats || [];

    // Filter video formats
    const videoFormats = formats.filter(f => f.ext && ['mp4', 'webm', 'mkv'].includes(f.ext));

    switch (quality) {
      case 'highest':
        return 'bestvideo+bestaudio/best';
      case 'high':
        // 1080p or best available
        const hd = videoFormats.find(f => f.resolution?.includes('1080') || f.resolution?.includes('1920'));
        return hd ? hd.formatId : 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
      case 'medium':
        // 720p
        const medium = videoFormats.find(f => f.resolution?.includes('720') || f.resolution?.includes('1280'));
        return medium ? medium.formatId : 'bestvideo[height<=720]+bestaudio/best[height<=720]';
      case 'low':
        return 'worst';
      default:
        return 'best';
    }
  }

  /**
   * Get available formats for selection UI
   */
  getAvailableFormats(info: DownloadInfo): Array<{
    formatId: string;
    label: string;
    size?: string;
    quality?: string;
  }> {
    const formats = info.formats || [];
    const grouped: Map<string, typeof formats> = new Map();

    // Group by resolution
    for (const format of formats) {
      const key = format.resolution || format.ext || 'unknown';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(format);
    }

    // Build selection options
    const options: Array<{ formatId: string; label: string; size?: string; quality?: string }> = [];

    // Best option
    options.push({
      formatId: 'best',
      label: 'Best Quality',
      quality: 'highest',
    });

    // Grouped by resolution
    for (const [resolution, formatList] of grouped.entries()) {
      if (formatList.length > 0) {
        const best = formatList.reduce((prev, curr) => 
          (curr.filesize || 0) > (prev.filesize || 0) ? curr : prev
        );
        options.push({
          formatId: best.formatId,
          label: resolution || best.ext || 'Unknown',
          size: best.filesize ? this.formatBytes(best.filesize) : undefined,
          quality: best.resolution || undefined,
        });
      }
    }

    // Audio-only option
    options.push({
      formatId: 'bestaudio',
      label: 'Audio Only (MP3)',
      quality: 'audio',
    });

    return options;
  }

  /**
   * Format bytes to human-readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
  }
}

// Singleton instance
let selectorInstance: FormatSelector | null = null;

export function getFormatSelector(): FormatSelector {
  if (!selectorInstance) {
    selectorInstance = new FormatSelector();
  }
  return selectorInstance;
}

