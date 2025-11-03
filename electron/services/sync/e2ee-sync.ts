/**
 * E2EE Sync System - Brave Sync 2.0 Style Encrypted Chain
 * End-to-end encrypted sync without central server
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface SyncData {
  type: 'bookmark' | 'history' | 'knowledge' | 'workspace' | 'settings';
  id: string;
  data: unknown;
  timestamp: number;
  version: number;
}

export interface SyncChain {
  chainId: string;
  head: string; // Hash of latest block
  blocks: SyncBlock[];
}

export interface SyncBlock {
  id: string;
  previousHash: string;
  data: SyncData[];
  timestamp: number;
  hash: string;
}

export interface E2EESyncConfig {
  enabled: boolean;
  syncEndpoint?: string; // Optional relay server
  encryptionKey?: string; // Derived from user password
  chainId?: string;
}

export class E2EESyncService {
  private config: E2EESyncConfig;
  private chain: SyncChain | null = null;
  private storagePath: string;
  private pendingSync: SyncData[] = [];

  constructor(config: E2EESyncConfig) {
    this.config = config;
    this.storagePath = path.join(app.getPath('userData'), 'sync-chain');
    this.ensureStorageDir();
  }

  /**
   * Initialize sync chain (call once per device)
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled || !this.config.encryptionKey) {
      return;
    }

    await this.loadChain();
    
    if (!this.chain) {
      // Create new chain
      this.config.chainId = this.config.chainId || randomBytes(16).toString('hex');
      this.chain = {
        chainId: this.config.chainId,
        head: '',
        blocks: [],
      };
      await this.saveChain();
    }
  }

  /**
   * Encrypt and sync data
   */
  async sync(data: SyncData[]): Promise<void> {
    if (!this.config.enabled || !this.config.encryptionKey) {
      // Queue for later
      this.pendingSync.push(...data);
      return;
    }

    if (!this.chain) {
      await this.initialize();
    }

    if (!this.chain) {
      return;
    }

    // Create new block
    const previousHash = this.chain.head || 'genesis';
    const block: SyncBlock = {
      id: randomBytes(16).toString('hex'),
      previousHash,
      data,
      timestamp: Date.now(),
      hash: '',
    };

    // Calculate hash
    block.hash = this.hashBlock(block);

    // Encrypt block data
    const encrypted = this.encryptBlock(block);

    // Add to chain
    this.chain.blocks.push(block);
    this.chain.head = block.hash;

    await this.saveChain();

    // Sync to relay server (if configured)
    if (this.config.syncEndpoint) {
      await this.syncToRelay(encrypted);
    }
  }

  /**
   * Pull and merge remote changes
   */
  async pull(): Promise<SyncData[]> {
    if (!this.config.enabled || !this.config.syncEndpoint) {
      return [];
    }

    try {
      const response = await fetch(`${this.config.syncEndpoint}/chain/${this.config.chainId}/blocks`, {
        headers: {
          'X-Chain-Id': this.config.chainId!,
          'X-Head': this.chain?.head || '',
        },
      });

      if (!response.ok) {
        return [];
      }

      const encryptedBlocks = await response.json() as string[];
      const newData: SyncData[] = [];

      for (const encrypted of encryptedBlocks) {
        const block = this.decryptBlock(encrypted);
        if (block && this.isValidBlock(block)) {
          // Merge block data
          newData.push(...block.data);
          
          // Add to chain if not already present
          if (!this.chain?.blocks.find(b => b.id === block.id)) {
            this.chain?.blocks.push(block);
          }
        }
      }

      if (this.chain) {
        // Recalculate head
        this.chain.head = this.chain.blocks[this.chain.blocks.length - 1]?.hash || '';
        await this.saveChain();
      }

      return newData;
    } catch (error) {
      console.error('[E2EESync] Pull error:', error);
      return [];
    }
  }

  /**
   * Get all synced data of a type
   */
  getData(type: SyncData['type']): SyncData[] {
    if (!this.chain) {
      return [];
    }

    const data: SyncData[] = [];
    
    for (const block of this.chain.blocks) {
      for (const item of block.data) {
        if (item.type === type) {
          // Keep latest version of each item
          const existing = data.find(d => d.id === item.id);
          if (!existing || item.version > existing.version) {
            if (existing) {
              const index = data.indexOf(existing);
              data[index] = item;
            } else {
              data.push(item);
            }
          }
        }
      }
    }

    return data;
  }

  /**
   * Delete item from sync
   */
  async delete(type: SyncData['type'], id: string): Promise<void> {
    // Mark as deleted by syncing a deletion marker
    await this.sync([{
      type,
      id,
      data: null,
      timestamp: Date.now(),
      version: -1, // Negative version indicates deletion
    }]);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<E2EESyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): E2EESyncConfig {
    return { ...this.config };
  }

  // Private methods

  private hashBlock(block: Omit<SyncBlock, 'hash'>): string {
    const data = JSON.stringify({
      id: block.id,
      previousHash: block.previousHash,
      data: block.data,
      timestamp: block.timestamp,
    });
    return createHash('sha256').update(data).digest('hex');
  }

  private encryptBlock(block: SyncBlock): string {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key required');
    }

    const key = createHash('sha256').update(this.config.encryptionKey).digest();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    
    const data = JSON.stringify(block);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptBlock(encrypted: string): SyncBlock | null {
    if (!this.config.encryptionKey) {
      return null;
    }

    try {
      const [ivHex, encryptedData] = encrypted.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = createHash('sha256').update(this.config.encryptionKey).digest();
      const decipher = createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted) as SyncBlock;
    } catch {
      return null;
    }
  }

  private isValidBlock(block: SyncBlock): boolean {
    // Verify hash
    const calculatedHash = this.hashBlock(block);
    if (calculatedHash !== block.hash) {
      return false;
    }

    // Verify previous hash chain (if not genesis)
    if (this.chain && this.chain.blocks.length > 0) {
      const previousBlock = this.chain.blocks[this.chain.blocks.length - 1];
      if (previousBlock.hash !== block.previousHash) {
        return false;
      }
    }

    return true;
  }

  private async syncToRelay(encrypted: string): Promise<void> {
    if (!this.config.syncEndpoint || !this.config.chainId) {
      return;
    }

    try {
      await fetch(`${this.config.syncEndpoint}/chain/${this.config.chainId}/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chain-Id': this.config.chainId,
        },
        body: JSON.stringify({ encrypted }),
      });
    } catch (error) {
      console.error('[E2EESync] Relay sync error:', error);
    }
  }

  private async loadChain(): Promise<void> {
    const filePath = path.join(this.storagePath, 'chain.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.chain = JSON.parse(content) as SyncChain;
    } catch {
      // Chain doesn't exist yet
      this.chain = null;
    }
  }

  private async saveChain(): Promise<void> {
    if (!this.chain) {
      return;
    }

    const filePath = path.join(this.storagePath, 'chain.json');
    await fs.writeFile(filePath, JSON.stringify(this.chain, null, 2), 'utf-8');
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      console.error('[E2EESync] Failed to create storage directory:', error);
    }
  }
}

// Singleton instance
let e2eeSyncInstance: E2EESyncService | null = null;

export function getE2EESyncService(): E2EESyncService {
  if (!e2eeSyncInstance) {
    e2eeSyncInstance = new E2EESyncService({
      enabled: false,
    });
  }
  return e2eeSyncInstance;
}

