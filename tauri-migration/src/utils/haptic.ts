/**
 * Haptic Feedback Utility (Day 6)
 * Provides tactile feedback on mobile devices
 */

import { invoke } from '@tauri-apps/api/core';
import { isElectronRuntime } from '../lib/env';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Trigger haptic feedback on mobile devices
 */
export async function triggerHaptic(type: HapticType = 'medium'): Promise<void> {
  try {
    // Only trigger haptic on Tauri (mobile)
    if (typeof window === 'undefined' || isElectronRuntime()) {
      return;
    }

    // Check if running on mobile (iOS/Android)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      return;
    }

    // Tauri mobile haptic API
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      try {
        await invoke('trigger_haptic', { type });
      } catch {
        // Fallback to browser API if Tauri command not available
        if ('vibrate' in navigator) {
          const patterns: Record<HapticType, number | number[]> = {
            light: 10,
            medium: 20,
            heavy: 30,
            success: [20, 50, 20],
            warning: [30, 50, 30, 50, 30],
            error: [50, 100, 50, 100, 50],
          };
          navigator.vibrate(patterns[type]);
        }
      }
    } else if ('vibrate' in navigator) {
      // Browser fallback
      const patterns: Record<HapticType, number | number[]> = {
        light: 10,
        medium: 20,
        heavy: 30,
        success: [20, 50, 20],
        warning: [30, 50, 30, 50, 30],
        error: [50, 100, 50, 100, 50],
      };
      navigator.vibrate(patterns[type]);
    }
  } catch (error) {
    // Silently fail if haptic not available
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Haptic] Failed to trigger haptic feedback:', error);
    }
  }
}

/**
 * Hook for using haptic feedback in components
 */
export function useHaptic() {
  return {
    light: () => triggerHaptic('light'),
    medium: () => triggerHaptic('medium'),
    heavy: () => triggerHaptic('heavy'),
    success: () => triggerHaptic('success'),
    warning: () => triggerHaptic('warning'),
    error: () => triggerHaptic('error'),
  };
}
