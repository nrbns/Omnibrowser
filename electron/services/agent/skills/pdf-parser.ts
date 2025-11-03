/**
 * PDF Parser Tool - Agent skill for parsing PDF documents
 */

import { registry } from './registry';
import { getPDFParser } from '../../knowledge/pdf-parser';

registry.register('pdf:parse', async (_ctx, args: { filePath: string; extractCitations?: boolean; generateBibTeX?: boolean }) => {
  const parser = getPDFParser();
  
  try {
    const result = await parser.parsePDF(args.filePath);
    
    const response: any = {
      metadata: result.metadata,
      text: result.text,
      textLength: result.text.length,
      citations: result.citations,
    };

    // Generate BibTeX if requested
    if (args.generateBibTeX) {
      response.bibtex = parser.generateBibTeX(result.metadata, result.citations);
    }

    return response;
  } catch (error) {
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

registry.register('pdf:extract', async (_ctx, args: { filePath: string; pages?: number[] }) => {
  const parser = getPDFParser();
  
  try {
    const result = await parser.parsePDF(args.filePath);
    
    // If specific pages requested, extract those (simplified - would need page-by-page parsing)
    let text = result.text;
    if (args.pages && args.pages.length > 0) {
      // TODO: Implement page-by-page extraction
      // For now, return full text
    }

    return {
      text,
      metadata: result.metadata,
      pages: args.pages || 'all',
    };
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

