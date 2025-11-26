/**
 * Chart Export Utility
 * Exports charts as images with watermark support
 */

import { addWatermarkToCanvas, isWatermarkEnabled } from './watermark';
import type { IChartApi } from 'lightweight-charts';

/**
 * Export chart as PNG image with optional watermark
 */
export async function exportChartAsImage(
  chart: IChartApi,
  filename: string = 'chart.png',
  options?: {
    width?: number;
    height?: number;
    watermark?: boolean;
  }
): Promise<void> {
  try {
    // Get chart dimensions
    const container =
      chart.options().width && chart.options().height
        ? { width: chart.options().width as number, height: chart.options().height as number }
        : chart.timeScale().width() && chart.priceScale('right')?.width()
          ? {
              width: (chart.timeScale().width() || 0) + (chart.priceScale('right')?.width() || 0),
              height: chart.timeScale().height() || 0,
            }
          : { width: 1920, height: 1080 }; // Fallback

    const width = options?.width || container.width || 1920;
    const height = options?.height || container.height || 1080;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Get chart canvas element
    const chartCanvas = chart.timeScale().width()
      ? (chart as any).element?.querySelector('canvas')
      : null;

    if (chartCanvas) {
      // Draw chart to canvas
      ctx.drawImage(chartCanvas, 0, 0, width, height);
    } else {
      // Fallback: draw background and message
      ctx.fillStyle = '#030711';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Chart export not available', width / 2, height / 2);
    }

    // Add watermark if enabled
    if (options?.watermark !== false && isWatermarkEnabled()) {
      await addWatermarkToCanvas(canvas, {
        position: 'bottom-right',
        opacity: 0.7,
        showQR: true,
      });
    }

    // Convert to blob and download
    canvas.toBlob(blob => {
      if (!blob) {
        console.error('[ChartExport] Failed to create blob');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (error) {
    console.error('[ChartExport] Failed to export chart:', error);
    throw error;
  }
}

/**
 * Export chart as SVG (without watermark support yet)
 */
export async function exportChartAsSVG(
  chart: IChartApi,
  filename: string = 'chart.svg'
): Promise<void> {
  try {
    // Note: lightweight-charts doesn't support direct SVG export
    // This would require a different approach (e.g., converting canvas to SVG)
    console.warn('[ChartExport] SVG export not yet implemented');

    // Fallback to PNG
    await exportChartAsImage(chart, filename.replace('.svg', '.png'));
  } catch (error) {
    console.error('[ChartExport] Failed to export chart as SVG:', error);
    throw error;
  }
}
