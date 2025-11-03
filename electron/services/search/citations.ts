/**
 * Citation Spans - Attach source spans with hashes + timestamps
 */

import { createHash } from 'node:crypto';

export interface CitationSpan {
  id: string;
  text: string;
  hash: string;
  source: {
    url?: string;
    title?: string;
    timestamp: number;
  };
  metadata?: Record<string, unknown>;
}

export class CitationService {
  /**
   * Create citation span from text and source
   */
  createSpan(
    text: string,
    source: { url?: string; title?: string },
    metadata?: Record<string, unknown>
  ): CitationSpan {
    const hash = createHash('sha256').update(text).digest('hex').substring(0, 16);
    const id = `cite_${hash}_${Date.now()}`;

    return {
      id,
      text,
      hash,
      source: {
        ...source,
        timestamp: Date.now(),
      },
      metadata,
    };
  }

  /**
   * Create multiple citation spans from chunks
   */
  createSpans(
    chunks: Array<{ text: string; metadata?: Record<string, unknown> }>,
    source: { url?: string; title?: string }
  ): CitationSpan[] {
    return chunks.map(chunk =>
      this.createSpan(chunk.text, source, chunk.metadata)
    );
  }

  /**
   * Find citation by hash
   */
  findByHash(hash: string, citations: CitationSpan[]): CitationSpan | undefined {
    return citations.find(c => c.hash === hash);
  }

  /**
   * Format citation for display
   */
  formatCitation(citation: CitationSpan): string {
    const parts: string[] = [];
    
    if (citation.source.title) {
      parts.push(citation.source.title);
    }
    
    if (citation.source.url) {
      parts.push(citation.source.url);
    }
    
    if (citation.source.timestamp) {
      const date = new Date(citation.source.timestamp);
      parts.push(date.toLocaleDateString());
    }

    return parts.join(' - ');
  }

  /**
   * Generate BibTeX entry from citation
   */
  generateBibTeX(citation: CitationSpan): string {
    const key = citation.id.replace(/[^a-zA-Z0-9]/g, '');
    const year = new Date(citation.source.timestamp).getFullYear();

    let entry = `@misc{${key},\n`;
    entry += `  title = {${citation.source.title || 'Untitled'}},\n`;
    if (citation.source.url) {
      entry += `  url = {${citation.source.url}},\n`;
    }
    entry += `  year = {${year}},\n`;
    entry += `  note = {Accessed: ${new Date(citation.source.timestamp).toISOString()}}\n`;
    entry += '}';

    return entry;
  }
}

// Singleton instance
let citationInstance: CitationService | null = null;

export function getCitationService(): CitationService {
  if (!citationInstance) {
    citationInstance = new CitationService();
  }
  return citationInstance;
}

