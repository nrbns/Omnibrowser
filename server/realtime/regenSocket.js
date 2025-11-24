/* eslint-env node */
// @ts-check

import { redisClient } from '../config/redis.js';

/**
 * @typedef {import('../../shared/regen-events').RegenSocketEvent} RegenSocketEvent
 */

const CHANNEL_PATTERN = 'omnibrowser:out:*';
const HEARTBEAT_INTERVAL_MS = 25000;

let subscriberPromise = null;
const connectionMap = new Map();

async function getSubscriber() {
  if (subscriberPromise) {
    return subscriberPromise;
  }

  const subscriber = redisClient.duplicate();
  subscriberPromise = subscriber
    .connect()
    .then(async () => {
      await subscriber.psubscribe(CHANNEL_PATTERN);
      subscriber.on('pmessage', (_pattern, channel, payload) => {
        const clientId = channel.replace('omnibrowser:out:', '');
        const socket = connectionMap.get(clientId);
        if (!socket || socket.readyState !== socket.OPEN) {
          return;
        }
        try {
          socket.send(payload);
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[RegenRealtime] Failed to forward event to client', {
              clientId,
              error: error?.message || error,
            });
          }
        }
      });
      return subscriber;
    })
    .catch(error => {
      subscriberPromise = null;
      console.error('[RegenRealtime] Failed to connect Redis subscriber', error?.message || error);
      throw error;
    });

  subscriber.on('error', error => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[RegenRealtime] Redis subscriber error', error?.message || error);
    }
  });

  return subscriberPromise;
}

function parseClientId(request) {
  try {
    const url = new URL(request.raw.url, `http://${request.headers.host}`);
    return url.searchParams.get('clientId');
  } catch {
    return null;
  }
}

function attachHeartbeat(socket) {
  if (socket.__regenHeartbeat) {
    clearInterval(socket.__regenHeartbeat);
  }
  socket.__regenHeartbeat = setInterval(() => {
    if (socket.readyState === socket.OPEN) {
      socket.ping?.();
    } else {
      clearInterval(socket.__regenHeartbeat);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Register the Regen WebSocket endpoint on the provided Fastify instance.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ path?: string }} [options]
 */
export async function registerRegenSocketServer(fastify, options = {}) {
  const path = options.path || '/agent/stream';
  await getSubscriber();

  fastify.get(
    path,
    {
      websocket: true,
    },
    (connection, request) => {
      const clientId = parseClientId(request);
      if (!clientId) {
        connection.socket.close(4001, 'clientId query param required');
        return;
      }

      const existing = connectionMap.get(clientId);
      if (existing) {
        try {
          existing.close(4002, 'superseded');
        } catch {
          // ignore
        }
      }

      connectionMap.set(clientId, connection.socket);
      attachHeartbeat(connection.socket);

      connection.socket.on('close', () => {
        clearInterval(connection.socket.__regenHeartbeat);
        if (connectionMap.get(clientId) === connection.socket) {
          connectionMap.delete(clientId);
        }
      });

      connection.socket.on('error', error => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[RegenRealtime] WebSocket error', error?.message || error);
        }
      });

      // Immediately acknowledge the connection so the renderer can show "connected".
      const ackEvent = {
        clientId,
        type: 'status',
        phase: 'idle',
        label: 'connected',
        timestamp: Date.now(),
      };
      try {
        connection.socket.send(JSON.stringify(ackEvent));
      } catch {
        // ignore
      }
    }
  );

  fastify.addHook('onClose', async () => {
    for (const socket of connectionMap.values()) {
      try {
        socket.close(4000, 'server_shutdown');
      } catch {
        // ignore
      }
    }
    connectionMap.clear();

    if (subscriberPromise) {
      try {
        const subscriber = await subscriberPromise;
        await subscriber.punsubscribe(CHANNEL_PATTERN);
        await subscriber.quit();
      } catch {
        // ignore shutdown errors
      }
      subscriberPromise = null;
    }
  });
}
