import { BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow) {
  mainWindow = win;
}

export function getMainWindow(): BrowserWindow | null {
  if (!mainWindow) {
    // Fallback: try to get the focused window or first window
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      return windows[0];
    }
  }
  return mainWindow;
}


