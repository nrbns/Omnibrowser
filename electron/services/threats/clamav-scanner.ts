/**
 * ClamAV Integration - Antivirus file scanning
 * Uses ClamAV daemon (clamd) or clamscan command-line tool
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const execAsync = promisify(exec);

export interface ClamAVResult {
  clean: boolean;
  infected: boolean;
  threats: string[];
  scanTime: number;
  method: 'clamd' | 'clamscan' | 'none';
}

export interface ClamAVConfig {
  enabled: boolean;
  daemonSocket?: string; // Unix socket path (default: /var/run/clamav/clamd.ctl)
  daemonHost?: string; // TCP host (default: localhost)
  daemonPort?: number; // TCP port (default: 3310)
  commandPath?: string; // Path to clamscan binary
  timeout?: number; // Scan timeout in milliseconds
}

class ClamAVScanner {
  private config: ClamAVConfig = {
    enabled: true,
    timeout: 30000, // 30 seconds
  };

  private clamdAvailable: boolean | null = null;
  private clamscanAvailable: boolean | null = null;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClamAVConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if ClamAV daemon is available
   */
  async checkClamdAvailable(): Promise<boolean> {
    if (this.clamdAvailable !== null) {
      return this.clamdAvailable;
    }

    try {
      // Try to connect to clamd socket or TCP
      const socket = this.config.daemonSocket || '/var/run/clamav/clamd.ctl';
      const host = this.config.daemonHost || 'localhost';
      const port = this.config.daemonPort || 3310;

      // Check socket file exists (Unix)
      if (socket && process.platform !== 'win32') {
        try {
          await fs.access(socket);
          this.clamdAvailable = true;
          return true;
        } catch {
          // Socket doesn't exist
        }
      }

      // Try TCP connection (cross-platform)
      try {
        const net = require('net');
        const client = net.createConnection(port, host);
        await new Promise((resolve, reject) => {
          client.on('connect', () => {
            client.end();
            resolve(true);
          });
          client.on('error', reject);
          setTimeout(() => reject(new Error('Timeout')), 2000);
        });
        this.clamdAvailable = true;
        return true;
      } catch {
        // TCP not available
      }

      this.clamdAvailable = false;
      return false;
    } catch {
      this.clamdAvailable = false;
      return false;
    }
  }

  /**
   * Check if clamscan command is available
   */
  async checkClamscanAvailable(): Promise<boolean> {
    if (this.clamscanAvailable !== null) {
      return this.clamscanAvailable;
    }

    try {
      const command = this.config.commandPath || 'clamscan';
      await execAsync(`${command} --version`, { timeout: 5000 });
      this.clamscanAvailable = true;
      return true;
    } catch {
      this.clamscanAvailable = false;
      return false;
    }
  }

  /**
   * Scan file using ClamAV
   */
  async scanFile(filePath: string): Promise<ClamAVResult> {
    if (!this.config.enabled) {
      return {
        clean: true,
        infected: false,
        threats: [],
        scanTime: 0,
        method: 'none',
      };
    }

    const startTime = Date.now();

    // Try clamd first (faster)
    const clamdAvailable = await this.checkClamdAvailable();
    if (clamdAvailable) {
      try {
        return await this.scanWithClamd(filePath, startTime);
      } catch (error) {
        console.warn('[ClamAV] Daemon scan failed, falling back to clamscan:', error);
      }
    }

    // Fallback to clamscan
    const clamscanAvailable = await this.checkClamscanAvailable();
    if (clamscanAvailable) {
      try {
        return await this.scanWithClamscan(filePath, startTime);
      } catch (error) {
        console.error('[ClamAV] clamscan failed:', error);
      }
    }

    // No ClamAV available
    return {
      clean: true,
      infected: false,
      threats: [],
      scanTime: Date.now() - startTime,
      method: 'none',
    };
  }

  /**
   * Scan using ClamAV daemon (clamd)
   */
  private async scanWithClamd(filePath: string, startTime: number): Promise<ClamAVResult> {
    const net = require('net');
    const socket = this.config.daemonSocket || '/var/run/clamav/clamd.ctl';
    const host = this.config.daemonHost || 'localhost';
    const port = this.config.daemonPort || 3310;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error('ClamAV daemon timeout'));
      }, this.config.timeout || 30000);

      const client = process.platform === 'win32' || !socket
        ? net.createConnection(port, host)
        : net.createConnection(socket);

      let response = '';

      client.on('connect', () => {
        // Send SCAN command
        client.write(`SCAN ${filePath}\n`);
      });

      client.on('data', (data: Buffer) => {
        response += data.toString();
        
        // Check if scan is complete (ends with OK or FOUND)
        if (response.includes('OK\n') || response.includes('FOUND')) {
          clearTimeout(timeout);
          client.end();

          const lines = response.trim().split('\n');
          const threats: string[] = [];
          let infected = false;

          for (const line of lines) {
            if (line.includes('FOUND')) {
              infected = true;
              // Extract threat name: "filename: ThreatName.UNOFFICIAL FOUND"
              const match = line.match(/:\s+([^\s]+)\s+FOUND/);
              if (match) {
                threats.push(match[1]);
              }
            }
          }

          resolve({
            clean: !infected,
            infected,
            threats,
            scanTime: Date.now() - startTime,
            method: 'clamd',
          });
        }
      });

      client.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Scan using clamscan command-line tool
   */
  private async scanWithClamscan(filePath: string, startTime: number): Promise<ClamAVResult> {
    const command = this.config.commandPath || 'clamscan';
    
    try {
      const { stdout, stderr } = await execAsync(
        `${command} --no-summary "${filePath}"`,
        { timeout: this.config.timeout || 30000 }
      );

      // Parse output
      // clamscan returns exit code 0 for clean, 1 for infected
      // Output format: "filename: ThreatName.UNOFFICIAL FOUND"
      const output = stdout || stderr;
      const threats: string[] = [];
      let infected = false;

      if (output.includes('FOUND')) {
        infected = true;
        const lines = output.split('\n');
        for (const line of lines) {
          const match = line.match(/:\s+([^\s]+)\s+FOUND/);
          if (match) {
            threats.push(match[1]);
          }
        }
      }

      return {
        clean: !infected,
        infected,
        threats,
        scanTime: Date.now() - startTime,
        method: 'clamscan',
      };
    } catch (error: any) {
      // Exit code 1 means virus found
      if (error.code === 1 && error.stdout) {
        const threats: string[] = [];
        const output = error.stdout;
        const lines = output.split('\n');
        
        for (const line of lines) {
          const match = line.match(/:\s+([^\s]+)\s+FOUND/);
          if (match) {
            threats.push(match[1]);
          }
        }

        return {
          clean: false,
          infected: true,
          threats,
          scanTime: Date.now() - startTime,
          method: 'clamscan',
        };
      }
      
      throw error;
    }
  }

  /**
   * Update virus definitions (freshclam)
   */
  async updateDefinitions(): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { stdout } = await execAsync('freshclam', { timeout: 60000 });
      return { success: true, output: stdout };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }
}

// Singleton instance
let clamavInstance: ClamAVScanner | null = null;

export function getClamAVScanner(): ClamAVScanner {
  if (!clamavInstance) {
    clamavInstance = new ClamAVScanner();
  }
  return clamavInstance;
}

