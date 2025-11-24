/* eslint-env node */
// @ts-check

import { redisClient } from '../config/redis.js';

/**
 * @typedef {import('../../shared/regen-events').RegenSocketEvent} RegenSocketEvent
 */

let publisherPromise = null;

async function getPublisher() {
  if (publisherPromise) {
    return publisherPromise;
  }

  const publisher = redisClient.duplicate();
  publisherPromise = publisher
    .connect()
    .then(() => publisher)
    .catch(error => {
      publisherPromise = null;
      console.error('[RegenRealtime] Failed to connect Redis publisher', error?.message || error);
      throw error;
    });

  publisher.on('error', error => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[RegenRealtime] Redis publisher error', error?.message || error);
    }
  });

  return publisherPromise;
}

/**
 * Publish a Regen event to the browser-specific Redis channel.
 * @param {RegenSocketEvent} event
 */
export async function sendToClient(event) {
  if (!event?.clientId) {
    throw new Error('sendToClient requires a clientId on the event payload');
  }

  const enrichedEvent = {
    ...event,
    timestamp: typeof event.timestamp === 'number' ? event.timestamp : Date.now(),
  };

  const channel = `omnibrowser:out:${enrichedEvent.clientId}`;

  try {
    const publisher = await getPublisher();
    await publisher.publish(channel, JSON.stringify(enrichedEvent));
  } catch (error) {
    console.error('[RegenRealtime] Failed to publish event', {
      channel,
      error: error?.message || error,
    });
    throw error;
  }
}
