/**
 * Cloud Vector Store - Qdrant/Pinecone Integration
 * Syncs local knowledge graph to cloud for cross-device access
 */

export interface CloudVectorStoreConfig {
  provider: 'qdrant' | 'pinecone' | 'none';
  endpoint?: string;
  apiKey?: string;
  collection?: string;
  enabled: boolean;
}

export interface CloudDocument {
  id: string;
  text: string;
  url?: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface CloudSearchResult {
  id: string;
  text: string;
  url?: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class CloudVectorStore {
  private config: CloudVectorStoreConfig;
  private syncQueue: CloudDocument[] = [];
  private isSyncing = false;

  constructor(config: CloudVectorStoreConfig) {
    this.config = config;
  }

  /**
   * Check if cloud sync is enabled and available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled || this.config.provider === 'none') {
      return false;
    }

    try {
      if (this.config.provider === 'qdrant') {
        return await this.checkQdrant();
      } else if (this.config.provider === 'pinecone') {
        return await this.checkPinecone();
      }
    } catch {
      return false;
    }

    return false;
  }

  /**
   * Sync local embeddings to cloud
   */
  async sync(documents: CloudDocument[]): Promise<void> {
    if (!await this.isAvailable()) {
      // Queue for later sync
      this.syncQueue.push(...documents);
      return;
    }

    if (this.isSyncing) {
      // Queue if already syncing
      this.syncQueue.push(...documents);
      return;
    }

    this.isSyncing = true;

    try {
      if (this.config.provider === 'qdrant') {
        await this.syncToQdrant(documents);
      } else if (this.config.provider === 'pinecone') {
        await this.syncToPinecone(documents);
      }

      // Process queued documents
      if (this.syncQueue.length > 0) {
        const queued = [...this.syncQueue];
        this.syncQueue = [];
        await this.sync(queued);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Search cloud vector store
   */
  async search(queryEmbedding: number[], topK = 10): Promise<CloudSearchResult[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    try {
      if (this.config.provider === 'qdrant') {
        return await this.searchQdrant(queryEmbedding, topK);
      } else if (this.config.provider === 'pinecone') {
        return await this.searchPinecone(queryEmbedding, topK);
      }
    } catch (error) {
      console.error('[CloudVectorStore] Search error:', error);
      return [];
    }

    return [];
  }

  /**
   * Delete document from cloud
   */
  async delete(ids: string[]): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }

    try {
      if (this.config.provider === 'qdrant') {
        await this.deleteQdrant(ids);
      } else if (this.config.provider === 'pinecone') {
        await this.deletePinecone(ids);
      }
    } catch (error) {
      console.error('[CloudVectorStore] Delete error:', error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CloudVectorStoreConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CloudVectorStoreConfig {
    return { ...this.config };
  }

  // Qdrant implementation
  private async checkQdrant(): Promise<boolean> {
    if (!this.config.endpoint || !this.config.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.endpoint}/collections/${this.config.collection || 'omnibrowser'}`, {
        headers: {
          'api-key': this.config.apiKey,
        },
      });

      return response.ok || response.status === 404; // 404 means we can create it
    } catch {
      return false;
    }
  }

  private async syncToQdrant(documents: CloudDocument[]): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      throw new Error('Qdrant endpoint and API key required');
    }

    const collection = this.config.collection || 'omnibrowser';
    const endpoint = this.config.endpoint;

    // Ensure collection exists
    try {
      await fetch(`${endpoint}/collections/${collection}`, {
        method: 'PUT',
        headers: {
          'api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vectors: {
            size: documents[0]?.embedding.length || 384,
            distance: 'Cosine',
          },
        }),
      });
    } catch {
      // Collection might already exist
    }

    // Upsert points
    const points = documents.map(doc => ({
      id: doc.id,
      vector: doc.embedding,
      payload: {
        text: doc.text,
        url: doc.url,
        timestamp: doc.timestamp,
        ...doc.metadata,
      },
    }));

    await fetch(`${endpoint}/collections/${collection}/points`, {
      method: 'PUT',
      headers: {
        'api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ points }),
    });
  }

  private async searchQdrant(queryEmbedding: number[], topK: number): Promise<CloudSearchResult[]> {
    if (!this.config.endpoint || !this.config.apiKey) {
      return [];
    }

    const collection = this.config.collection || 'omnibrowser';

    const response = await fetch(`${this.config.endpoint}/collections/${collection}/points/search`, {
      method: 'POST',
      headers: {
        'api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: queryEmbedding,
        limit: topK,
        with_payload: true,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { result: Array<{ id: string; score: number; payload: Record<string, unknown> }> };
    
    return data.result.map(item => ({
      id: item.id,
      text: (item.payload.text as string) || '',
      url: item.payload.url as string | undefined,
      score: item.score,
      metadata: item.payload,
    }));
  }

  private async deleteQdrant(ids: string[]): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      return;
    }

    const collection = this.config.collection || 'omnibrowser';

    await fetch(`${this.config.endpoint}/collections/${collection}/points/delete`, {
      method: 'POST',
      headers: {
        'api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ points: ids }),
    });
  }

  // Pinecone implementation
  private async checkPinecone(): Promise<boolean> {
    if (!this.config.endpoint || !this.config.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.endpoint}/describe_index_stats`, {
        headers: {
          'Api-Key': this.config.apiKey,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private async syncToPinecone(documents: CloudDocument[]): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      throw new Error('Pinecone endpoint and API key required');
    }

    const vectors = documents.map(doc => ({
      id: doc.id,
      values: doc.embedding,
      metadata: {
        text: doc.text,
        url: doc.url || '',
        timestamp: doc.timestamp,
        ...doc.metadata,
      },
    }));

    await fetch(`${this.config.endpoint}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Api-Key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vectors,
        namespace: this.config.collection || 'omnibrowser',
      }),
    });
  }

  private async searchPinecone(queryEmbedding: number[], topK: number): Promise<CloudSearchResult[]> {
    if (!this.config.endpoint || !this.config.apiKey) {
      return [];
    }

    const response = await fetch(`${this.config.endpoint}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        namespace: this.config.collection || 'omnibrowser',
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> };
    
    return data.matches.map(match => ({
      id: match.id,
      text: (match.metadata?.text as string) || '',
      url: match.metadata?.url as string | undefined,
      score: match.score,
      metadata: match.metadata,
    }));
  }

  private async deletePinecone(ids: string[]): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      return;
    }

    await fetch(`${this.config.endpoint}/vectors/delete`, {
      method: 'POST',
      headers: {
        'Api-Key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids,
        namespace: this.config.collection || 'omnibrowser',
      }),
    });
  }
}

// Singleton instance
let cloudVectorStoreInstance: CloudVectorStore | null = null;

export function getCloudVectorStore(): CloudVectorStore {
  if (!cloudVectorStoreInstance) {
    cloudVectorStoreInstance = new CloudVectorStore({
      provider: 'none',
      enabled: false,
    });
  }
  return cloudVectorStoreInstance;
}

