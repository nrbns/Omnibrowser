/**
 * Embedding Pipeline - Generate embeddings and store in Qdrant
 */

import { getChunkingService, Chunk } from './chunker';
import { getCloudVectorStore } from '../knowledge/cloud-vector-store';

export interface EmbeddingResult {
  chunkId: string;
  embedding?: number[];
  success: boolean;
  error?: string;
}

export class EmbeddingService {
  /**
   * Generate embeddings for chunks and store in vector store
   */
  async embedChunks(
    chunks: Chunk[],
    collection?: string
  ): Promise<EmbeddingResult[]> {
    const vectorStore = getCloudVectorStore();
    const results: EmbeddingResult[] = [];

    // Check if vector store is configured
    const config = vectorStore.getConfig();
    if (!config.enabled || !config.endpoint) {
      // Fallback: return chunks without embeddings
      return chunks.map(chunk => ({
        chunkId: chunk.id,
        success: false,
        error: 'Vector store not configured',
      }));
    }

    // Generate embeddings using Ollama (if available) or cloud service
    for (const chunk of chunks) {
      try {
        // Try Ollama embedding first (local)
        const embedding = await this.generateEmbedding(chunk.text);

        if (embedding) {
          // Store in vector store
          await vectorStore.add([
            {
              text: chunk.text,
              metadata: {
                ...chunk.metadata,
                chunkId: chunk.id,
                startIndex: chunk.startIndex,
                endIndex: chunk.endIndex,
              },
            },
          ]);

          results.push({
            chunkId: chunk.id,
            embedding,
            success: true,
          });
        } else {
          results.push({
            chunkId: chunk.id,
            success: false,
            error: 'Failed to generate embedding',
          });
        }
      } catch (error) {
        results.push({
          chunkId: chunk.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Generate embedding for text using Ollama
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const response = await fetch('http://localhost:11434/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: text.substring(0, 4096), // Limit to 4k chars
        }),
      });

      if (response.ok) {
        const data = await response.json() as { embedding: number[] };
        return data.embedding;
      }
    } catch (error) {
      console.warn('[Embedder] Ollama embedding failed:', error);
    }

    return null;
  }

  /**
   * Process and embed a document
   */
  async processDocument(
    text: string,
    metadata?: Record<string, unknown>
  ): Promise<EmbeddingResult[]> {
    const chunker = getChunkingService();
    const chunks = chunker.chunkText(text, metadata);
    return await this.embedChunks(chunks);
  }
}

// Singleton instance
let embedderInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embedderInstance) {
    embedderInstance = new EmbeddingService();
  }
  return embedderInstance;
}

