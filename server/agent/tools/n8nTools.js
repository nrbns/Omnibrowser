/* eslint-env node */
// @ts-check

import { sendToClient } from '../../realtime/sendToClient.js';

const N8N_BASE_URL = process.env.N8N_BASE_URL || process.env.N8N_WEBHOOK_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

async function postJson(url, body) {
  const headers = {
    'content-type': 'application/json',
  };
  if (N8N_API_KEY) {
    headers['x-n8n-api-key'] = N8N_API_KEY;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `n8n request failed (${response.status})`);
  }
  return response.json().catch(() => ({}));
}

/**
 * Trigger an n8n workflow and notify the renderer once acked.
 * @param {string} clientId
 * @param {string} workflowSlug
 * @param {Record<string, unknown>} payload
 */
export async function triggerAutomation(clientId, workflowSlug, payload = {}) {
  if (!N8N_BASE_URL) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[RegenAutomation] N8N_BASE_URL missing, skipping workflow trigger');
    }
    return;
  }

  const endpoint = `${N8N_BASE_URL.replace(/\/$/, '')}/${workflowSlug}`;
  try {
    await postJson(endpoint, payload);
    await sendToClient({
      clientId,
      type: 'notification',
      notificationId: `n8n-${workflowSlug}-${Date.now()}`,
      severity: 'success',
      title: 'Automation triggered',
      body: `Workflow "${workflowSlug}" is running.`,
      timestamp: Date.now(),
    });
  } catch (error) {
    await sendToClient({
      clientId,
      type: 'notification',
      notificationId: `n8n-${workflowSlug}-${Date.now()}`,
      severity: 'error',
      title: 'Automation failed',
      body: error?.message || 'Unable to start workflow',
      timestamp: Date.now(),
    });
  }
}
