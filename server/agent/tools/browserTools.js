/* eslint-env node */
// @ts-check

import { sendToClient } from '../../realtime/sendToClient.js';

/**
 * Dispatch a command event to the renderer.
 * @param {string} clientId
 * @param {import('../../../shared/regen-events').RegenCommandType} command
 * @param {import('../../../shared/regen-events').RegenCommandPayload} [payload]
 */
async function dispatchCommand(clientId, command, payload) {
  await sendToClient({
    clientId,
    type: 'command',
    command,
    payload,
    timestamp: Date.now(),
  });
}

export async function openTab(clientId, url) {
  await dispatchCommand(clientId, 'OPEN_TAB', { url });
}

export async function switchTab(clientId, tabId) {
  await dispatchCommand(clientId, 'SWITCH_TAB', { tabId });
}

export async function navigate(clientId, tabId, url) {
  await dispatchCommand(clientId, 'NAVIGATE', { tabId, url });
}

export async function scrollTab(clientId, tabId, amount, direction = 'down') {
  await dispatchCommand(clientId, 'SCROLL', { tabId, amount, direction });
}

export async function clickElement(clientId, tabId, selector) {
  await dispatchCommand(clientId, 'CLICK_ELEMENT', { tabId, selector });
}

export async function requestDomSnapshot(clientId, tabId) {
  await dispatchCommand(clientId, 'GET_DOM', { tabId });
}

export async function focusWebContent(clientId, tabId) {
  await dispatchCommand(clientId, 'SET_FOCUS', { tabId });
}

export async function speak(clientId, text) {
  await dispatchCommand(clientId, 'SPEAK', { text });
}
