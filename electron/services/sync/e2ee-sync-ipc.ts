/**
 * IPC handlers for E2EE Sync
 */

import { registerHandler } from '../../shared/ipc/router';
import { z } from 'zod';
import { getE2EESyncService } from './e2ee-sync';

export function registerE2EESyncIpc() {
  registerHandler('sync:config', z.object({
    enabled: z.boolean(),
    syncEndpoint: z.string().url().optional(),
    encryptionKey: z.string().optional(),
    chainId: z.string().optional(),
  }), async (_event, request) => {
    const service = getE2EESyncService();
    service.updateConfig(request);
    
    if (request.enabled) {
      await service.initialize();
    }
    
    return { success: true };
  });

  registerHandler('sync:sync', z.object({
    type: z.enum(['bookmark', 'history', 'knowledge', 'workspace', 'settings']),
    data: z.array(z.object({
      id: z.string(),
      data: z.any(),
      version: z.number().optional(),
    })),
  }), async (_event, request) => {
    const service = getE2EESyncService();
    
    const syncData = request.data.map(item => ({
      type: request.type,
      id: item.id,
      data: item.data,
      timestamp: Date.now(),
      version: item.version ?? 1,
    }));

    await service.sync(syncData);
    return { success: true };
  });

  registerHandler('sync:pull', z.object({}), async () => {
    const service = getE2EESyncService();
    const newData = await service.pull();
    return { data: newData };
  });

  registerHandler('sync:get', z.object({
    type: z.enum(['bookmark', 'history', 'knowledge', 'workspace', 'settings']),
  }), async (_event, request) => {
    const service = getE2EESyncService();
    const data = service.getData(request.type);
    return { data };
  });

  registerHandler('sync:delete', z.object({
    type: z.enum(['bookmark', 'history', 'knowledge', 'workspace', 'settings']),
    id: z.string(),
  }), async (_event, request) => {
    const service = getE2EESyncService();
    await service.delete(request.type, request.id);
    return { success: true };
  });

  registerHandler('sync:init', z.object({
    password: z.string(),
  }), async (_event, request) => {
    const service = getE2EESyncService();
    // Derive encryption key from password
    const { createHash } = require('node:crypto');
    const encryptionKey = createHash('sha256').update(request.password).digest('hex');
    service.updateConfig({ encryptionKey, enabled: true });
    await service.initialize();
    return { success: true };
  });

  registerHandler('sync:status', z.object({}), async () => {
    const service = getE2EESyncService();
    const config = (service as any).config;
    const chain = (service as any).chain;
    return { 
      synced: config?.enabled && chain !== null, 
      chainId: chain?.chainId,
      enabled: config?.enabled || false,
    };
  });

  // Override sync handler to support empty request for manual sync
  registerHandler('sync:sync', z.union([
    z.object({
      type: z.enum(['bookmark', 'history', 'knowledge', 'workspace', 'settings']),
      data: z.array(z.object({
        id: z.string(),
        data: z.any(),
        version: z.number().optional(),
      })),
    }),
    z.object({}).optional(),
  ]), async (_event, request) => {
    const service = getE2EESyncService();
    
    // If empty request, sync pending data
    if (!request || (typeof request === 'object' && Object.keys(request).length === 0)) {
      const pendingSync = (service as any).pendingSync;
      if (pendingSync && pendingSync.length > 0) {
        await service.sync([...pendingSync]);
        (service as any).pendingSync = [];
      }
      return { success: true };
    }
    
    // Otherwise, sync provided data
    const syncData = request.data.map((item: any) => ({
      type: request.type,
      id: item.id,
      data: item.data,
      timestamp: Date.now(),
      version: item.version ?? 1,
    }));

    await service.sync(syncData);
    return { success: true };
  });
}

