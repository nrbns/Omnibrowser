/**
 * Performance Controls IPC Handlers
 */

import { z } from 'zod';
import os from 'node:os';
import { BrowserWindow } from 'electron';
import { registerHandler } from '../../shared/ipc/router';
import { getGPUControls } from './gpu-controls';
import { getCrashRecovery } from './crash-recovery';
import { updateBatteryState, getProcessRamMb } from './resource-monitor';
import { forceHibernateTabs, setManualOverride } from './efficiency-manager';
import { getTabs } from '../tabs';

export function registerPerformanceIpc(): void {
  // GPU Controls
  registerHandler('performance:gpu:enableRaster', z.object({}), async () => {
    const gpu = getGPUControls();
    gpu.enableRaster();
    return { success: true, config: gpu.getConfig() };
  });

  registerHandler('performance:gpu:disableRaster', z.object({}), async () => {
    const gpu = getGPUControls();
    gpu.disableRaster();
    return { success: true, config: gpu.getConfig() };
  });

  registerHandler('performance:gpu:enableHardwareDecode', z.object({}), async () => {
    const gpu = getGPUControls();
    gpu.enableHardwareDecode();
    return { success: true, config: gpu.getConfig() };
  });

  registerHandler('performance:gpu:disableHardwareDecode', z.object({}), async () => {
    const gpu = getGPUControls();
    gpu.disableHardwareDecode();
    return { success: true, config: gpu.getConfig() };
  });

  registerHandler('performance:gpu:getConfig', z.object({}), async () => {
    const gpu = getGPUControls();
    return { config: gpu.getConfig() };
  });

  registerHandler(
    'performance:battery:update',
    z.object({
      level: z.number().min(0).max(1).nullable().optional(),
      charging: z.boolean().nullable().optional(),
      chargingTime: z.number().nullable().optional(),
      dischargingTime: z.number().nullable().optional(),
    }),
    async (_event, data) => {
      updateBatteryState({
        level: typeof data.level === 'number' ? data.level : null,
        charging: typeof data.charging === 'boolean' ? data.charging : null,
        chargingTime: typeof data.chargingTime === 'number' ? data.chargingTime : null,
        dischargingTime: typeof data.dischargingTime === 'number' ? data.dischargingTime : null,
      });
      return { success: true };
    },
  );

  // Crash Recovery
  registerHandler('performance:snapshot:create', z.object({
    windows: z.array(z.object({
      bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
      tabs: z.array(z.object({
        id: z.string(),
        url: z.string(),
        title: z.string().optional(),
      })),
      activeTabId: z.string().optional(),
    })),
    workspace: z.string().optional(),
  }), async (_event, request) => {
    const recovery = getCrashRecovery();
    const snapshotId = await recovery.createSnapshot(request.windows, request.workspace);
    return { snapshotId };
  });

  registerHandler('performance:snapshot:restore', z.object({
    snapshotId: z.string(),
  }), async (_event, request) => {
    const recovery = getCrashRecovery();
    const snapshot = await recovery.restoreSnapshot(request.snapshotId);
    return { snapshot };
  });

  registerHandler('performance:snapshot:latest', z.object({}), async () => {
    const recovery = getCrashRecovery();
    const snapshot = await recovery.getLatestSnapshot();
    return { snapshot };
  });

  registerHandler('performance:snapshot:list', z.object({}), async () => {
    const recovery = getCrashRecovery();
    const snapshots = await recovery.listSnapshots();
    return { snapshots };
  });

  registerHandler(
    'efficiency:applyMode',
    z.object({ mode: z.enum(['normal', 'battery-saver', 'extreme']) }),
    async (_event, request) => {
      setManualOverride(request.mode);
      return { success: true };
    },
  );

  registerHandler('efficiency:clearOverride', z.object({}), async () => {
    setManualOverride(null);
    return { success: true };
  });

  registerHandler('efficiency:hibernate', z.object({}), async () => {
    const count = forceHibernateTabs();
    return { success: true, count };
  });

  // Get current system metrics for real-time updates
  registerHandler('performance:getMetrics', z.object({}), async () => {
    const ramMb = await getProcessRamMb();
    const cpuLoad1 = os.loadavg()[0] || 0;
    const activeTabs = BrowserWindow.getAllWindows().reduce((acc, win) => {
      try {
        return acc + getTabs(win).length;
      } catch {
        return acc;
      }
    }, 0);
    
    // Calculate CPU percentage (loadavg[0] is 1-minute average, convert to percentage)
    // On multi-core systems, divide by number of cores
    const cpuCores = os.cpus().length;
    const cpuPercent = Math.min(100, Math.round((cpuLoad1 / cpuCores) * 100));
    
    // Calculate RAM percentage (process memory vs total system memory)
    const totalMemory = os.totalmem();
    const usedMemory = process.memoryUsage().rss;
    const ramPercent = Math.min(100, Math.round((usedMemory / totalMemory) * 100));
    
    return {
      cpu: cpuPercent,
      memory: ramPercent,
      cpuLoad1,
      ramMb,
      activeTabs,
      timestamp: Date.now(),
    };
  });
}

