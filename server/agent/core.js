/* eslint-env node */
// @ts-check

import { randomUUID } from 'crypto';
import { sendToClient } from '../realtime/sendToClient.js';
import { openTab, scrollTab } from './tools/browserTools.js';
import { searchWeb, summarizeSearchResults } from './tools/searchTools.js';
import { triggerAutomation } from './tools/n8nTools.js';

const STREAM_DELAY_MS = 35;

/**
 * @typedef {Object} RegenMessageInput
 * @property {string} clientId
 * @property {string} text
 * @property {'research'|'trade'|'browser'|'automation'} [mode]
 * @property {string} [locale]
 * @property {string} [requestId]
 */

/**
 * Entry point for Regen text queries. This function keeps the event contract simple:
 * statuses are emitted for every stage, tokens are streamed as message events,
 * and any tool actions are mirrored through the command channel.
 * @param {RegenMessageInput} input
 */
export async function handleMessageSafe(input) {
  const { clientId, text, mode = 'research', locale = 'en', requestId } = input ?? {};
  if (!clientId) {
    throw new Error('handleMessageSafe requires clientId');
  }
  if (!text?.trim()) {
    throw new Error('Nothing to process');
  }

  const trimmed = text.trim();
  const runId = randomUUID();

  await emitStatus(clientId, 'planning', 'Understanding your request…', requestId);

  try {
    const searchResults =
      mode === 'browser'
        ? []
        : await searchWeb(trimmed, mode === 'trade' ? 5 : 3);

    if (searchResults[0]) {
      await openTab(clientId, searchResults[0].url);
    }

    await emitStatus(clientId, 'thinking', 'Synthesizing findings…', requestId);
    await streamResponse(
      clientId,
      `Let me break down "${trimmed}" for you.`,
      runId,
      requestId
    );

    if (searchResults.length > 0) {
      await streamResponse(
        clientId,
        summarizeSearchResults(searchResults),
        runId,
        requestId,
        true
      );
    } else {
      await streamResponse(clientId, 'No external sources yet, switching to reasoning mode.', runId, requestId);
    }

    await emitStatus(clientId, 'executing', 'Coordinating tools…', requestId);

    if (mode === 'automation') {
      await triggerAutomation(clientId, 'regen/automation', {
        runId,
        locale,
        text: trimmed,
      });
    } else if (mode === 'research' && searchResults[1]) {
      await openTab(clientId, searchResults[1].url);
      await scrollTab(clientId, undefined, 600, 'down');
    }

    await emitStatus(clientId, 'idle', 'Ready for the next request', requestId);
    return { runId, sources: searchResults };
  } catch (error) {
    await emitError(clientId, error, requestId);
    throw error;
  }
}

async function emitStatus(clientId, phase, detail, requestId) {
  await sendToClient({
    clientId,
    type: 'status',
    phase,
    detail,
    requestId,
    timestamp: Date.now(),
  });
}

async function emitError(clientId, error, requestId) {
  await sendToClient({
    clientId,
    type: 'error',
    code: 'regen_runtime_error',
    message: error?.message || 'Regen encountered an error',
    detail: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
    timestamp: Date.now(),
    requestId,
  });
}

async function streamResponse(clientId, text, runId, requestId, markDone = false) {
  const messageId = `${runId}-${Date.now()}`;
  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i += 1) {
    const chunk = tokens[i];
    const isLast = markDone && i === tokens.length - 1;
    await sendToClient({
      clientId,
      type: 'message',
      messageId,
      role: 'agent',
      text: chunk,
      stream: !isLast,
      done: isLast,
      timestamp: Date.now(),
      requestId,
    });
    if (!isLast) {
      await delay(STREAM_DELAY_MS);
    }
  }
}

function tokenize(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(line => line.trim())
    .filter(Boolean);
}

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
