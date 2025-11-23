import crypto from 'node:crypto';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { createLogger } from './utils/logger';

const log = createLogger('ledger');

type Block = {
  id: number;
  parent_hash: string;
  doc_url: string;
  passage: string;
  passage_hash: string;
  ts: number;
};
const chain: Block[] = [];

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function registerLedgerIpc() {
  registerHandler(
    'ledger:add',
    z.object({
      url: z.string(),
      passage: z.string(),
    }),
    async (_event, { url, passage }) => {
      try {
        const parent = chain.at(-1)?.passage_hash || 'GENESIS';
        const ts = Date.now();
        const passage_hash = sha256Hex(parent + passage + String(ts));
        chain.push({
          id: chain.length + 1,
          parent_hash: parent,
          doc_url: url,
          passage,
          passage_hash,
          ts,
        });
        return { id: chain.length, passage_hash };
      } catch (error) {
        log.error('Failed to add ledger entry', { error, url });
        throw new Error(
          `Failed to add ledger entry: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  registerHandler('ledger:list', z.object({}), async () => {
    try {
      return chain;
    } catch (error) {
      log.error('Failed to list ledger', { error });
      throw new Error(
        `Failed to list ledger: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  registerHandler('ledger:verify', z.object({}), async () => {
    try {
      let prev = 'GENESIS';
      for (const b of chain) {
        const expect = sha256Hex(prev + b.passage + String(b.ts));
        if (expect !== b.passage_hash) return { ok: false, badId: b.id };
        prev = b.passage_hash;
      }
      return { ok: true };
    } catch (error) {
      log.error('Failed to verify ledger', { error });
      throw new Error(
        `Failed to verify ledger: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
