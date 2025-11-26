/**
 * Watermark System for Viral Growth
 * Adds "Made with RegenBrowser" + QR code to all exports
 */

import QRCode from 'qrcode';

const DOWNLOAD_URL = 'https://regenbrowser.com/download'; // Update with actual URL
const WATERMARK_TEXT = 'Made with RegenBrowser - Free Download';

export interface WatermarkOptions {
  opacity?: number;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  showQR?: boolean;
  customText?: string;
}

const DEFAULT_OPTIONS: Required<WatermarkOptions> = {
  opacity: 0.7,
  position: 'bottom-right',
  showQR: true,
  customText: WATERMARK_TEXT,
};

/**
 * Generate QR code data URL for download link
 */
export async function generateQRCodeDataURL(url: string = DOWNLOAD_URL): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: 120,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (error) {
    console.error('[Watermark] Failed to generate QR code:', error);
    return '';
  }
}

/**
 * Add watermark to canvas (for images/screenshots)
 */
export async function addWatermarkToCanvas(
  canvas: HTMLCanvasElement,
  options: WatermarkOptions = {}
): Promise<HTMLCanvasElement> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const padding = 20;
  const fontSize = Math.max(12, width / 60);

  // Calculate position
  let x = padding;
  let y = height - padding;

  if (opts.position.includes('right')) {
    x = width - padding;
  }
  if (opts.position.includes('top')) {
    y = padding;
  }
  if (opts.position.includes('center')) {
    x = width / 2;
    y = height / 2;
  }

  // Save context
  ctx.save();

  // Draw semi-transparent background for text
  const textMetrics = ctx.measureText(opts.customText);
  const textWidth = textMetrics.width;
  const textHeight = fontSize + 10;
  const bgPadding = 10;

  ctx.fillStyle = `rgba(0, 0, 0, ${opts.opacity * 0.5})`;
  ctx.fillRect(
    x - textWidth / 2 - bgPadding,
    y - textHeight - bgPadding,
    textWidth + bgPadding * 2,
    textHeight + (opts.showQR ? 140 : 0) + bgPadding * 2
  );

  // Draw text
  ctx.fillStyle = `rgba(255, 255, 255, ${opts.opacity})`;
  ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(opts.customText, x, y - textHeight);

  // Draw QR code if enabled
  if (opts.showQR) {
    const qrDataURL = await generateQRCodeDataURL();
    if (qrDataURL) {
      const qrSize = 100;
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => {
          ctx.drawImage(qrImg, x - qrSize / 2, y - textHeight + 20, qrSize, qrSize);
          resolve();
        };
        qrImg.onerror = reject;
        qrImg.src = qrDataURL;
      });
    }
  }

  ctx.restore();
  return canvas;
}

/**
 * Add watermark to PDF (using pdf-lib)
 */
export async function addWatermarkToPDF(
  pdfBytes: Uint8Array,
  options: WatermarkOptions = {}
): Promise<Uint8Array> {
  try {
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Generate QR code
    let qrImage: any = null;
    if (opts.showQR) {
      const qrDataURL = await generateQRCodeDataURL();
      if (qrDataURL) {
        try {
          // Convert data URL to PNG bytes
          const qrResponse = await fetch(qrDataURL);
          const qrBlob = await qrResponse.blob();
          const qrArrayBuffer = await qrBlob.arrayBuffer();
          qrImage = await pdfDoc.embedPng(new Uint8Array(qrArrayBuffer));
        } catch (error) {
          console.warn('[Watermark] Failed to embed QR code in PDF:', error);
        }
      }
    }

    // Add watermark to each page
    for (const page of pages) {
      const { width, height } = page.getSize();

      // Calculate position
      let x = 50;
      let y = 50;

      if (opts.position.includes('right')) {
        x = width - 50;
      }
      if (opts.position.includes('top')) {
        y = height - 50;
      }
      if (opts.position.includes('center')) {
        x = width / 2;
        y = height / 2;
      }

      // Draw text background
      const fontSize = 10;
      const textWidth = helveticaFont.widthOfTextAtSize(opts.customText, fontSize);
      page.drawRectangle({
        x: x - textWidth / 2 - 5,
        y: y - fontSize - 5,
        width: textWidth + 10,
        height: fontSize + (qrImage ? 120 : 0) + 10,
        color: rgb(0, 0, 0),
        opacity: opts.opacity * 0.5,
      });

      // Draw text
      page.drawText(opts.customText, {
        x: x - textWidth / 2,
        y: y - fontSize,
        size: fontSize,
        font: helveticaFont,
        color: rgb(1, 1, 1),
        opacity: opts.opacity,
      });

      // Draw QR code
      if (qrImage) {
        page.drawImage(qrImage, {
          x: x - 50,
          y: y - fontSize - 110,
          width: 100,
          height: 100,
        });
      }
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error('[Watermark] Failed to add watermark to PDF:', error);
    // Return original if watermarking fails
    return pdfBytes;
  }
}

/**
 * Check if user has watermarking enabled (Pro users can disable)
 */
export function isWatermarkEnabled(): boolean {
  try {
    const settings = localStorage.getItem('regen:watermark-enabled');
    if (settings === null) return true; // Default: enabled for free users
    return settings === 'true';
  } catch {
    return true;
  }
}

/**
 * Set watermark preference
 */
export function setWatermarkEnabled(enabled: boolean): void {
  try {
    localStorage.setItem('regen:watermark-enabled', String(enabled));
  } catch (error) {
    console.error('[Watermark] Failed to save preference:', error);
  }
}
