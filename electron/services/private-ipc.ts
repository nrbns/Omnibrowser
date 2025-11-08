/**
 * IPC handlers for Private/Ghost windows
 */

import { BrowserWindow } from 'electron';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { createPrivateWindow, createGhostTab, closeAllPrivateWindows } from './private';
import { getMainWindow } from './windows';
import { panicWipe, forensicCleanse } from './burn';
import { getActiveProfileForWindow, profileAllows } from './profiles';

export function registerPrivateIpc() {
  registerHandler('private:createWindow', z.object({
    url: z.string().url().optional(),
    autoCloseAfter: z.number().optional(), // milliseconds
    contentProtection: z.boolean().optional(),
    ghostMode: z.boolean().optional(),
  }), async (event, request) => {
    const sourceWin = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    const activeProfile = getActiveProfileForWindow(sourceWin || null);

    if (!profileAllows(activeProfile.id, 'private-window')) {
      if (sourceWin && !sourceWin.isDestroyed()) {
        sourceWin.webContents.send('profiles:policy-blocked', {
          action: 'private-window',
          profileId: activeProfile.id,
        });
      }
      throw new Error('Private windows are disabled by your current profile policy.');
    }

    const win = createPrivateWindow({
      url: request.url,
      autoCloseAfter: request.autoCloseAfter,
      contentProtection: request.contentProtection,
      ghostMode: request.ghostMode,
      profileId: activeProfile.id,
    });
    return { windowId: win.id };
  });

  registerHandler('private:createGhostTab', z.object({
    url: z.string().url().optional(),
  }), async (event, request) => {
    const mainWindow = getMainWindow() || BrowserWindow.fromWebContents(event.sender);
    if (!mainWindow) {
      throw new Error('No main window available');
    }

    const activeProfile = getActiveProfileForWindow(mainWindow);
    if (!profileAllows(activeProfile.id, 'ghost-tab')) {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('profiles:policy-blocked', {
          action: 'ghost-tab',
          profileId: activeProfile.id,
        });
      }
      throw new Error('Ghost tabs are disabled by your current profile policy.');
    }

    const tabId = await createGhostTab(mainWindow, request.url || 'about:blank');
    return { tabId };
  });

  registerHandler('private:closeAll', z.object({}), async () => {
    const count = closeAllPrivateWindows();
    return { count };
  });

  registerHandler('private:panicWipe', z.object({
    forensic: z.boolean().optional(),
  }), async (_event, request) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      throw new Error('No main window available');
    }
    if (request.forensic) {
      await forensicCleanse(mainWindow);
    } else {
      await panicWipe(mainWindow);
    }
    return { success: true };
  });
}
