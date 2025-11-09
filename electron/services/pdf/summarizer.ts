/**
 * PDF Summarization - Extract text → summarize with citations
 */

// @ts-nocheck

import { getPDFParser } from '../knowledge/pdf-parser';
import { getOllamaAdapter } from '../agent/ollama-adapter';
import { getCitationService } from '../search/citations';

export interface PDFSummary {
  summary: string;
  citations: Array<{
    id: string;
    text: string;
    hash: string;
    page?: number;
  }>;
  metadata: {
    pageCount: number;
    wordCount: number;
    generatedAt: number;
  };
}

export class PDFSummarizer {
  /**
   * Summarize PDF with citations
   */
  async summarize(
    filePath: string,
    options?: { maxLength?: number; includeCitations?: boolean }
  ): Promise<PDFSummary> {
    const parser = getPDFParser();
    const citationService = getCitationService();

    // Parse PDF
    const pdfData = await parser.parsePDF(filePath);
    const text = pdfData.text;
    const metadata = pdfData.metadata || {};

    // Generate summary using LLM
    const ollama = getOllamaAdapter();
    const isAvailable = await ollama.checkAvailable();

    let summary = '';
    if (isAvailable) {
      summary = await this.generateSummaryLLM(text, options?.maxLength);
    } else {
      // Fallback to extractive summary (first N sentences)
      summary = this.generateExtractiveSummary(text, options?.maxLength || 500);
    }

    // Generate citations if requested
    const citations: PDFSummary['citations'] = [];
    if (options?.includeCitations !== false) {
      // Create citation spans for key sentences
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const keySentences = sentences.slice(0, 10); // Top 10 sentences

      for (const sentence of keySentences) {
        const span = citationService.createSpan(sentence, {
          url: `file://${filePath}`,
          title: metadata.title || 'PDF Document',
        });

        citations.push({
          id: span.id,
          text: span.text,
          hash: span.hash,
        });
      }
    }

    return {
      summary,
      citations,
      metadata: {
        pageCount: metadata.pages || 0,
        wordCount: text.split(/\s+/).length,
        generatedAt: Date.now(),
      },
    };
  }

  /**
   * Generate summary using LLM
   */
  private async generateSummaryLLM(text: string, maxLength?: number): Promise<string> {
    const targetLength = maxLength || 500;
    const prompt = `Summarize the following text in approximately ${targetLength} words, focusing on key points and main ideas:

${text.substring(0, 8000)}${text.length > 8000 ? '...' : ''}`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        return data.response.trim();
      }
    } catch (error) {
      console.warn('[PDFSummarizer] LLM summary failed:', error);
    }

    // Fallback to extractive
    return this.generateExtractiveSummary(text, targetLength);
  }

  /**
   * Generate extractive summary (first N sentences)
   */
  private generateExtractiveSummary(text: string, maxLength: number): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    let summary = '';
    let charCount = 0;

    for (const sentence of sentences) {
      if (charCount + sentence.length > maxLength) break;
      summary += sentence.trim() + '. ';
      charCount += sentence.length;
    }

    return summary.trim() || text.substring(0, maxLength);
  }
}

// Singleton instance
let summarizerInstance: PDFSummarizer | null = null;

export function getPDFSummarizer(): PDFSummarizer {
  if (!summarizerInstance) {
    summarizerInstance = new PDFSummarizer();
  }
  return summarizerInstance;
}

