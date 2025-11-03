/**
 * IPC handlers for Cloud Vector Store
 */

import { registerHandler } from '../../shared/ipc/router';
import { z } from 'zod';
import { getCloudVectorStore } from './cloud-vector-store';
import { getVectorStore } from '../omni-brain/vector-store';

export function registerCloudVectorIpc() {
  registerHandler('cloud-vector:config', z.object({
    provider: z.enum(['qdrant', 'pinecone', 'none']),
    endpoint: z.string().url().optional(),
    apiKey: z.string().optional(),
    collection: z.string().optional(),
    enabled: z.boolean(),
  }), async (_event, request) => {
    const store = getCloudVectorStore();
    store.updateConfig(request);
    return { success: true };
  });

  registerHandler('cloud-vector:sync', z.object({
    documentIds: z.array(z.string()).optional(),
  }), async (_event, request) => {
    const cloudStore = getCloudVectorStore();
    const localStore = getVectorStore();

    if (!request.documentIds) {
      // Sync all documents
      const docs = localStore.listDocuments();
      const cloudDocs = docs.map(doc => ({
        id: doc.id,
        text: doc.text,
        url: doc.url,
        embedding: doc.embedding || [],
        metadata: doc.metadata,
        timestamp: doc.timestamp,
      }));

      await cloudStore.sync(cloudDocs);
      return { success: true, synced: cloudDocs.length };
    } else {
      // Sync specific documents
      const docs = request.documentIds
        .map(id => localStore.getDocument(id))
        .filter((d): d is NonNullable<typeof d> => d !== undefined)
        .map(doc => ({
          id: doc.id,
          text: doc.text,
          url: doc.url,
          embedding: doc.embedding || [],
          metadata: doc.metadata,
          timestamp: doc.timestamp,
        }));

      await cloudStore.sync(docs);
      return { success: true, synced: docs.length };
    }
  });

  registerHandler('cloud-vector:search', z.object({
    query: z.string(),
    topK: z.number().optional(),
  }), async (_event, request) => {
    const cloudStore = getCloudVectorStore();
    const localStore = getVectorStore();

    // Generate query embedding using local store
    const queryEmbedding = await (async () => {
      // Use local vector store's embedding method (simplified)
      const ollama = await import('../agent/ollama-adapter').then(m => m.getOllamaAdapter());
      const isAvailable = await ollama.checkAvailable();

      if (isAvailable) {
        try {
          const response = await fetch('http://localhost:11434/api/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama3.2',
              prompt: request.query.substring(0, 2048),
            }),
          });

          if (response.ok) {
            const data = await response.json() as { embedding: number[] };
            return data.embedding;
          }
        } catch {
          // Fallback
        }
      }

      // Fallback: hash-based embedding
      const vector: number[] = new Array(32).fill(0);
      for (let i = 0; i < request.query.length; i++) {
        const hash = request.query.charCodeAt(i);
        vector[hash % 32] += hash / 255;
      }
      const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      return vector.map(v => magnitude > 0 ? v / magnitude : 0);
    })();

    const results = await cloudStore.search(queryEmbedding, request.topK || 10);
    return { results };
  });

  registerHandler('cloud-vector:available', z.object({}), async () => {
    const store = getCloudVectorStore();
    const available = await store.isAvailable();
    return { available };
  });
}

