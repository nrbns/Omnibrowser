/**
 * PDF Export Utility with Watermark Integration
 * Creates PDFs from content and automatically adds watermarks
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { addWatermarkToPDF, isWatermarkEnabled } from './watermark';

export interface PDFExportOptions {
  title?: string;
  content: string;
  author?: string;
  subject?: string;
  includeWatermark?: boolean;
}

/**
 * Export text content as PDF with optional watermark
 */
export async function exportTextToPDF(options: PDFExportOptions): Promise<Blob> {
  const {
    content,
    title = 'Document',
    author = 'RegenBrowser',
    subject,
    includeWatermark = true,
  } = options;

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Set document metadata
  pdfDoc.setTitle(title);
  pdfDoc.setAuthor(author);
  if (subject) {
    pdfDoc.setSubject(subject);
  }
  pdfDoc.setCreator('RegenBrowser');
  pdfDoc.setProducer('RegenBrowser PDF Export');

  // Add a page
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  const margin = 50;
  const maxWidth = width - 2 * margin;
  const fontSize = 12;
  const lineHeight = fontSize * 1.5;

  // Add title
  page.drawText(title, {
    x: margin,
    y: height - margin - fontSize,
    size: 18,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });

  // Split content into lines that fit the page width
  const lines = splitTextIntoLines(content, helveticaFont, fontSize, maxWidth);
  let currentY = height - margin - 50;
  let currentPage = page;

  for (const line of lines) {
    // Check if we need a new page
    if (currentY < margin + lineHeight) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = height - margin;
    }

    currentPage.drawText(line, {
      x: margin,
      y: currentY,
      size: fontSize,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    currentY -= lineHeight;
  }

  // Add watermark if enabled
  let pdfBytes = await pdfDoc.save();
  if (includeWatermark && isWatermarkEnabled()) {
    pdfBytes = await addWatermarkToPDF(pdfBytes);
  }

  return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
}

/**
 * Export HTML content as PDF (basic implementation)
 */
export async function exportHTMLToPDF(options: PDFExportOptions): Promise<Blob> {
  // Convert HTML to plain text for now (can be enhanced with html2pdf later)
  const textContent = stripHTML(options.content);
  return exportTextToPDF({
    ...options,
    content: textContent,
  });
}

/**
 * Export research results as PDF
 */
export async function exportResearchToPDF(data: {
  query: string;
  summary: string;
  citations?: Array<{ index: number; quote?: string; source: { title: string; url: string } }>;
  sources?: Array<{ title: string; url: string; domain: string }>;
}): Promise<Blob> {
  let content = `Research Query: ${data.query}\n\n`;
  content += `Summary:\n${data.summary}\n\n`;

  if (data.citations && data.citations.length > 0) {
    content += `Citations:\n`;
    data.citations.forEach(c => {
      content += `[${c.index}] ${c.quote || 'Reference'}\n`;
      content += `   Source: ${c.source.title} (${c.source.url})\n\n`;
    });
  }

  if (data.sources && data.sources.length > 0) {
    content += `Sources:\n`;
    data.sources.forEach((s, idx) => {
      content += `${idx + 1}. ${s.title}\n`;
      content += `   ${s.url}\n`;
      content += `   Domain: ${s.domain}\n\n`;
    });
  }

  return exportTextToPDF({
    title: `Research: ${data.query}`,
    content,
    subject: 'Research Export',
  });
}

/**
 * Download PDF blob
 */
export async function downloadPDF(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Helper: Split text into lines that fit within max width
 */
function splitTextIntoLines(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Helper: Strip HTML tags from content
 */
function stripHTML(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
