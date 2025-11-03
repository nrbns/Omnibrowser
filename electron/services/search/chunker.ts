/**
 * Chunking Service - Split documents into 1-2k token chunks
 * Optimized for RAG retrieval
 */

export interface Chunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

export class ChunkingService {
  private chunkSize: number = 1500; // Target tokens per chunk
  private overlap: number = 200; // Token overlap between chunks

  /**
   * Split text into chunks
   */
  chunkText(
    text: string,
    metadata?: Record<string, unknown>,
    customChunkSize?: number
  ): Chunk[] {
    const targetSize = customChunkSize || this.chunkSize;
    const chunks: Chunk[] = [];
    
    // Simple token estimation (rough: 1 token ≈ 4 characters)
    const charToTokenRatio = 0.25;
    const targetChars = targetSize / charToTokenRatio;
    const overlapChars = this.overlap / charToTokenRatio;

    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < text.length) {
      let endIndex = Math.min(startIndex + targetChars, text.length);

      // Try to break at sentence boundaries
      if (endIndex < text.length) {
        const lastPeriod = text.lastIndexOf('.', endIndex);
        const lastNewline = text.lastIndexOf('\n', endIndex);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > startIndex + targetChars * 0.5) {
          endIndex = breakPoint + 1; // Include the period/newline
        }
      }

      const chunkText = text.slice(startIndex, endIndex);
      const tokenCount = Math.ceil(chunkText.length * charToTokenRatio);

      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: chunkText.trim(),
        startIndex,
        endIndex,
        tokenCount,
        metadata: {
          ...metadata,
          chunkIndex,
          totalChunks: 0, // Will be set after all chunks created
        },
      });

      // Move start forward with overlap
      startIndex = Math.max(startIndex + 1, endIndex - overlapChars);
      chunkIndex++;
    }

    // Update totalChunks metadata
    chunks.forEach(chunk => {
      if (chunk.metadata) {
        chunk.metadata.totalChunks = chunks.length;
      }
    });

    return chunks;
  }

  /**
   * Chunk HTML content (preserves structure better)
   */
  chunkHTML(html: string, metadata?: Record<string, unknown>): Chunk[] {
    // Remove HTML tags for token counting, but keep structure
    const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    return this.chunkText(textContent, { ...metadata, type: 'html' });
  }

  /**
   * Update chunk size
   */
  setChunkSize(size: number): void {
    this.chunkSize = size;
  }

  /**
   * Update overlap size
   */
  setOverlap(size: number): void {
    this.overlap = size;
  }
}

// Singleton instance
let chunkerInstance: ChunkingService | null = null;

export function getChunkingService(): ChunkingService {
  if (!chunkerInstance) {
    chunkerInstance = new ChunkingService();
  }
  return chunkerInstance;
}

