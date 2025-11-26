/**
 * Video Export Utility
 * Handles video processing, watermark overlay, and export to Reels/X format
 */

import { generateQRCodeDataURL } from './watermark';

/**
 * Draw watermark on canvas
 */
async function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): Promise<void> {
  const padding = 20;
  const qrSize = 80;
  const qrX = width - qrSize - padding;
  const qrY = height - qrSize - padding;

  // Draw QR code
  try {
    const qrDataUrl = await generateQRCodeDataURL();
    if (qrDataUrl) {
      const qrImage = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => {
          ctx.globalAlpha = 0.8;
          ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
          ctx.globalAlpha = 1.0;
          resolve();
        };
        qrImage.onerror = reject;
        qrImage.src = qrDataUrl;
      });
    }
  } catch (error) {
    console.error('[VideoExport] Watermark QR failed:', error);
  }

  // Draw text
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Made with RegenBrowser', width - padding, height - qrSize - padding - 5);
}

export interface VideoExportOptions {
  aspectRatio?: '9:16' | '16:9' | '1:1'; // Default: 9:16 for Reels/X
  maxDuration?: number; // seconds (default: 8)
  quality?: 'high' | 'medium' | 'low';
  watermark?: boolean;
  captions?: Array<{ text: string; startTime: number; endTime: number }>;
}

/**
 * Process video with watermark and export to optimized format
 */
export async function exportVideo(
  videoBlob: Blob,
  options: VideoExportOptions = {}
): Promise<Blob> {
  try {
    const {
      aspectRatio = '9:16',
      maxDuration = 8,
      quality = 'medium',
      watermark = true,
      captions = [],
    } = options;

    // Load video
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoBlob);

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });

    // Create canvas with target aspect ratio
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    // Calculate dimensions based on aspect ratio
    const [width, height] = getDimensionsForAspectRatio(
      video.videoWidth,
      video.videoHeight,
      aspectRatio
    );
    canvas.width = width;
    canvas.height = height;

    // Draw video frame (centered, with letterboxing/pillarboxing if needed)
    const drawFrame = async () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Calculate scaling to fit aspect ratio
      const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
      const scaledWidth = video.videoWidth * scale;
      const scaledHeight = video.videoHeight * scale;
      const offsetX = (width - scaledWidth) / 2;
      const offsetY = (height - scaledHeight) / 2;

      ctx.drawImage(video, offsetX, offsetY, scaledWidth, scaledHeight);

      // Add watermark if enabled
      if (watermark) {
        await drawWatermark(ctx, width, height);
      }

      // Add captions overlay
      if (captions.length > 0) {
        const currentTime = video.currentTime;
        const activeCaption = captions.find(
          c => currentTime >= c.startTime && currentTime <= c.endTime
        );

        if (activeCaption) {
          drawCaption(ctx, activeCaption.text, width, height);
        }
      }
    };

    // Record canvas frames to video
    const stream = canvas.captureStream(30); // 30 FPS
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: quality === 'high' ? 5000000 : quality === 'medium' ? 2500000 : 1000000,
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);

    // Start recording
    video.currentTime = 0;
    mediaRecorder.start();

    // Record frames
    const duration = Math.min(video.duration, maxDuration);
    const frameRate = 30;
    const totalFrames = duration * frameRate;
    let frameCount = 0;

    const recordFrame = () => {
      if (frameCount >= totalFrames || video.ended) {
        mediaRecorder.stop();
        return;
      }

      drawFrame().then(() => {
        frameCount++;
        video.currentTime = frameCount / frameRate;
        requestAnimationFrame(recordFrame);
      });
    };

    video.play();
    recordFrame();

    // Wait for recording to complete
    const recordedBlob = await new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        URL.revokeObjectURL(video.src);
        resolve(blob);
      };
      mediaRecorder.onerror = reject;

      // Timeout after max duration
      setTimeout(
        () => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        },
        (duration + 1) * 1000
      );
    });

    return recordedBlob;
  } catch (error) {
    console.error('[VideoExport] Export failed:', error);
    throw new Error(
      `Failed to export video: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate dimensions for target aspect ratio
 */
function getDimensionsForAspectRatio(
  originalWidth: number,
  originalHeight: number,
  aspectRatio: string
): [number, number] {
  const [aspectW, aspectH] = aspectRatio.split(':').map(Number);
  const aspectValue = aspectW / aspectH;

  let width: number;
  let height: number;

  if (aspectRatio === '9:16') {
    // Vertical (Reels/X format)
    width = 1080;
    height = 1920;
  } else if (aspectRatio === '16:9') {
    // Horizontal (YouTube)
    width = 1920;
    height = 1080;
  } else if (aspectRatio === '1:1') {
    // Square (Instagram)
    width = 1080;
    height = 1080;
  } else {
    // Calculate based on aspect ratio
    if (originalWidth / originalHeight > aspectValue) {
      height = 1080;
      width = Math.round(height * aspectValue);
    } else {
      width = 1080;
      height = Math.round(width / aspectValue);
    }
  }

  return [width, height];
}

/**
 * Draw caption text on canvas
 */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvasWidth: number,
  canvasHeight: number
): void {
  const fontSize = Math.round(canvasWidth / 30);
  const padding = 20;
  const maxWidth = canvasWidth - padding * 2;

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // Draw text shadow/outline for readability
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = fontSize / 10;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  // Word wrap
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) {
    lines.push(currentLine);
  }

  // Draw each line
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const y = canvasHeight - padding - totalHeight;

  lines.forEach((line, index) => {
    const x = canvasWidth / 2;
    const lineY = y + (index + 1) * lineHeight;

    // Draw outline
    ctx.strokeText(line, x, lineY);
    // Draw fill
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(line, x, lineY);
  });
}

/**
 * Download video file
 */
export async function downloadVideo(
  blob: Blob,
  filename: string = `regen-clip-${Date.now()}.webm`
): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share video to social media
 */
export async function shareVideo(
  blob: Blob,
  platform: 'instagram' | 'tiktok' | 'twitter' | 'generic'
): Promise<void> {
  try {
    if (navigator.share && platform === 'generic') {
      // Use Web Share API
      const file = new File([blob], 'regen-clip.webm', { type: 'video/webm' });
      await navigator.share({
        files: [file],
        title: 'Check out this RegenBrowser clip!',
        text: 'Made with RegenBrowser - The Internet Operating System',
      });
    } else {
      // Copy to clipboard or open platform
      const url = URL.createObjectURL(blob);

      if (platform === 'instagram') {
        // Instagram doesn't have direct API, but we can open their upload page
        window.open('https://www.instagram.com/', '_blank');
        // Show toast to manually upload
        throw new Error('Please upload the video manually to Instagram');
      } else if (platform === 'tiktok') {
        // TikTok also requires manual upload
        window.open('https://www.tiktok.com/upload', '_blank');
        throw new Error('Please upload the video manually to TikTok');
      } else if (platform === 'twitter') {
        // Twitter/X requires manual upload
        window.open('https://twitter.com/compose/tweet', '_blank');
        throw new Error('Please upload the video manually to X/Twitter');
      }

      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('[VideoExport] Share failed:', error);
    throw error;
  }
}
