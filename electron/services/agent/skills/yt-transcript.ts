/**
 * YouTube Transcript Tool - Agent skill for extracting video transcripts
 */

import { registry } from './registry';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';

const execAsync = promisify(exec);

// Check if yt-dlp is available
async function checkYtDlp(): Promise<boolean> {
  try {
    await execAsync('yt-dlp --version');
    return true;
  } catch {
    // Try python -m yt_dlp
    try {
      await execAsync('python -m yt_dlp --version');
      return true;
    } catch {
      return false;
    }
  }
}

async function getYtDlpCommand(): Promise<string> {
  try {
    await execAsync('yt-dlp --version');
    return 'yt-dlp';
  } catch {
    return 'python -m yt_dlp';
  }
}

registry.register('yt:transcript', async (_ctx, args: { url: string; language?: string }) => {
  const isAvailable = await checkYtDlp();
  if (!isAvailable) {
    throw new Error('yt-dlp not available. Please install yt-dlp or python yt_dlp package.');
  }

  const ytdlp = await getYtDlpCommand();
  const tempDir = path.join(require('os').tmpdir(), 'omnibrowser-yt-transcripts');
  await fs.mkdir(tempDir, { recursive: true });

  const outputPath = path.join(tempDir, `${Date.now()}.json`);

  try {
    // Extract transcript using yt-dlp
    const command = `${ytdlp} "${args.url}" --write-auto-sub --write-sub --sub-lang ${args.language || 'en'} --sub-format json3 --skip-download --output "${outputPath.replace('.json', '')}"`;

    await execAsync(command, { timeout: 30000 });

    // Try to read transcript JSON
    try {
      const transcriptData = await fs.readFile(outputPath.replace('.json', '.en.json3') || outputPath, 'utf-8');
      const transcript = JSON.parse(transcriptData);

      // Extract text from events
      const text = transcript.events
        ?.map((event: any) => event.segs?.map((seg: any) => seg.utf8 || '').join(''))
        .filter(Boolean)
        .join(' ') || '';

      // Cleanup
      await fs.unlink(outputPath).catch(() => {});

      return {
        url: args.url,
        language: args.language || 'en',
        text,
        length: text.length,
        events: transcript.events?.length || 0,
      };
    } catch {
      // Fallback: try to extract from .vtt or .srt files
      const files = await fs.readdir(path.dirname(outputPath));
      const subFile = files.find(f => f.endsWith('.vtt') || f.endsWith('.srt'));
      
      if (subFile) {
        const subText = await fs.readFile(path.join(path.dirname(outputPath), subFile), 'utf-8');
        // Simple VTT/SRT parsing (remove timestamps)
        const text = subText
          .split('\n')
          .filter(line => !line.match(/^\d+/) && !line.includes('-->') && line.trim())
          .join(' ')
          .replace(/<[^>]+>/g, '');

        return {
          url: args.url,
          language: args.language || 'en',
          text,
          length: text.length,
          source: 'subtitle_file',
        };
      }

      throw new Error('Could not extract transcript');
    }
  } catch (error) {
    // Cleanup on error
    await fs.unlink(outputPath).catch(() => {});
    throw new Error(`YouTube transcript extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

registry.register('yt:info', async (_ctx, args: { url: string }) => {
  const isAvailable = await checkYtDlp();
  if (!isAvailable) {
    throw new Error('yt-dlp not available');
  }

  const ytdlp = await getYtDlpCommand();

  try {
    // Get video info as JSON
    const { stdout } = await execAsync(`${ytdlp} "${args.url}" --dump-json`, { timeout: 15000 });
    const info = JSON.parse(stdout);

    return {
      url: args.url,
      title: info.title,
      description: info.description?.substring(0, 500),
      duration: info.duration,
      uploader: info.uploader,
      uploadDate: info.upload_date,
      viewCount: info.view_count,
      likeCount: info.like_count,
      thumbnail: info.thumbnail,
      availableSubtitles: Object.keys(info.subtitles || {}),
    };
  } catch (error) {
    throw new Error(`YouTube info extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

