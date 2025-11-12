/**
 * PDFium Bridge - Native module setup for PDF rendering
 * Falls back to pdfjs-dist if PDFium not available
 */

import * as fs from 'node:fs/promises';

export interface PDFPage {
  pageNumber: number;
  width: number;
  height: number;
  render?: () => Promise<Buffer>; // Rendered image data
}

export interface PDFDocument {
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
  };
  getPage: (pageNumber: number) => Promise<PDFPage>;
}

class PDFiumService {
  private usePDFium: boolean = false;

  /**
   * Check if PDFium is available
   */
  async checkPDFiumAvailable(): Promise<boolean> {
    // Try to require pdfium-node or similar
    try {
      // @ts-ignore - optional dependency
      require('pdfium-node');
      this.usePDFium = true;
      return true;
    } catch {
      // PDFium not available, use pdfjs-dist
      this.usePDFium = false;
      return false;
    }
  }

  /**
   * Load PDF document
   */
  async loadPDF(filePath: string): Promise<PDFDocument> {
    const isPDFiumAvailable = await this.checkPDFiumAvailable();

    if (isPDFiumAvailable) {
      return this.loadPDFium(filePath);
    } else {
      return this.loadPDFJS(filePath);
    }
  }

  /**
   * Load using PDFium native module
   */
  private async loadPDFium(filePath: string): Promise<PDFDocument> {
    try {
      // @ts-ignore
      const pdfium = require('pdfium-node');
      const pdfBuffer = await fs.readFile(filePath);
      const doc = pdfium.loadPDF(pdfBuffer);

      return {
        pageCount: doc.pageCount,
        metadata: doc.metadata || {},
        getPage: async (pageNumber: number) => {
          const page = doc.getPage(pageNumber - 1); // 0-indexed
          return {
            pageNumber,
            width: page.width,
            height: page.height,
            render: async () => {
              return page.render({ scale: 2.0 }); // 2x scale for retina
            },
          };
        },
      };
    } catch (error) {
      throw new Error(`PDFium load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load using pdfjs-dist (fallback)
   */
  private async loadPDFJS(filePath: string): Promise<PDFDocument> {
    try {
      const pdfjsLib = require('pdfjs-dist');
      const pdfBuffer = await fs.readFile(filePath);
      const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });

      const pdf = await loadingTask.promise;

      return {
        pageCount: pdf.numPages,
        metadata: pdf.metadata || {},
        getPage: async (pageNumber: number) => {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 2.0 });

          return {
            pageNumber,
            width: viewport.width,
            height: viewport.height,
            render: async () => {
              // Would need canvas for rendering
              // This is a placeholder - implement with node-canvas if needed
              return Buffer.from([]);
            },
          };
        },
      };
    } catch (error) {
      throw new Error(`PDF.js load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Singleton instance
let pdfiumInstance: PDFiumService | null = null;

export function getPDFiumService(): PDFiumService {
  if (!pdfiumInstance) {
    pdfiumInstance = new PDFiumService();
  }
  return pdfiumInstance;
}

