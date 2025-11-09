/**
 * Tor IPC Handlers
 */

import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { initializeTor, getTorService, type TorStatus } from './tor';
import { createLogger } from './utils/logger';

const TorStartRequest = z.object({
  port: z.number().min(1).max(65535).optional().default(9050),
  controlPort: z.number().min(1).max(65535).optional().default(9051),
  newnymInterval: z.number().min(1).optional(),
});

const TorStatusResponse = z.object({
  running: z.boolean(),
  bootstrapped: z.boolean(),
  progress: z.number(),
  error: z.string().optional(),
  circuitEstablished: z.boolean(),
  stub: z.boolean().optional(),
});

const logger = createLogger('tor-ipc');

let useStub = false;
const stubStatus: TorStatus & { stub?: boolean } = {
  running: false,
  bootstrapped: false,
  progress: 0,
  circuitEstablished: false,
  stub: true,
  error: 'Tor unavailable; running in stub mode',
};

export function registerTorIpc() {
  // Start Tor
  registerHandler('tor:start', TorStartRequest, async (_event, request) => {
    try {
      if (useStub) {
        stubStatus.running = true;
        stubStatus.bootstrapped = false;
        stubStatus.progress = 0;
        return { success: true, stub: true };
      }

      const torService = initializeTor({
        enabled: true,
        port: request.port || 9050,
        controlPort: request.controlPort || 9051,
        dataDir: '',
        newnymInterval: request.newnymInterval,
      });
      await torService.start();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Tor start failed; enabling stub', { error: message });
      useStub = true;
      stubStatus.running = false;
      stubStatus.error = message;
      return { success: true, stub: true, warning: message };
    }
  });

  // Stop Tor
  registerHandler('tor:stop', z.object({}), async () => {
    try {
      if (useStub) {
        stubStatus.running = false;
        stubStatus.bootstrapped = false;
        stubStatus.progress = 0;
        return { success: true, stub: true };
      }

      const torService = getTorService();
      await torService.stop();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Tor stop failed', { error: message });
      return { success: false, error: message };
    }
  });

  // Get Tor status
  registerHandler('tor:status', z.object({}), async () => {
    try {
      if (useStub) {
        return stubStatus as z.infer<typeof TorStatusResponse>;
      }

      const torService = getTorService();
      const status = torService.getStatus();
      return status as z.infer<typeof TorStatusResponse>;
    } catch {
      logger.warn('Tor status fetch failed; returning stub');
      useStub = true;
      return stubStatus as z.infer<typeof TorStatusResponse>;
    }
  });

  // Request new identity
  registerHandler('tor:newIdentity', z.object({}), async () => {
    try {
      if (useStub) {
        return { success: true, stub: true };
      }

      const torService = getTorService();
      await torService.newIdentity();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Tor new identity failed', { error: message });
      return { success: false, error: message };
    }
  });

  // Get proxy string
  registerHandler('tor:getProxy', z.object({}), async () => {
    try {
      if (useStub) {
        return { proxy: null, stub: true };
      }

      const torService = getTorService();
      return { proxy: torService.getProxyString() };
    } catch {
      logger.warn('Tor proxy fetch failed; returning stub');
      useStub = true;
      return { proxy: null, stub: true };
    }
  });
}

