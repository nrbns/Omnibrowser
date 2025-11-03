/**
 * IPC handlers for Hybrid Search
 */

import { registerHandler } from '../../shared/ipc/router';
import { z } from 'zod';
import { getHybridSearchService } from './hybrid-search';

export function registerHybridSearchIpc() {
  registerHandler('search:hybrid', z.object({
    query: z.string(),
    maxResults: z.number().optional(),
  }), async (_event, request) => {
    const service = getHybridSearchService();
    const results = await service.search(request.query, { maxResults: request.maxResults });
    return { results };
  });

  registerHandler('search:config', z.object({
    sources: z.object({
      brave: z.object({
        enabled: z.boolean(),
        apiKey: z.string().optional(),
      }).optional(),
      bing: z.object({
        enabled: z.boolean(),
        apiKey: z.string().optional(),
        endpoint: z.string().url().optional(),
      }).optional(),
      custom: z.object({
        enabled: z.boolean(),
      }).optional(),
    }).optional(),
    maxResults: z.number().optional(),
    rerank: z.boolean().optional(),
  }), async (_event, request) => {
    const service = getHybridSearchService();
    service.updateConfig(request as any);
    return { success: true };
  });
}

