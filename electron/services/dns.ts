/**
 * DNS-over-HTTPS (DoH) Service
 * Toggle DoH resolution with provider selection
 */

import * as dns from 'node:dns';
import { createLogger } from './utils/logger';

const DOH_PROVIDERS = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  quad9: 'https://dns.quad9.net/dns-query',
} as const;

type DoHProvider = keyof typeof DOH_PROVIDERS;

let dohEnabled = false;
let dohProvider: DoHProvider = 'cloudflare';

const logger = createLogger('dns');

/**
 * Enable DoH
 */
export async function enableDoH(provider: DoHProvider = 'cloudflare'): Promise<void> {
  dohEnabled = true;
  dohProvider = provider;
  logger.info('DoH enabled', { provider });
}

/**
 * Disable DoH (restore system DNS)
 */
export function disableDoH(): void {
  dohEnabled = false;
  logger.info('DoH disabled, falling back to system DNS');
}

/**
 * Check if DoH is enabled
 */
export function isDoHEnabled(): boolean {
  return dohEnabled;
}

/**
 * Get current DoH provider
 */
export function getDoHProvider(): DoHProvider {
  return dohProvider;
}

const fallbackLookup = (hostname: string): Promise<string[]> =>
  new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err: NodeJS.ErrnoException | null, addresses?: dns.LookupAddress[]) => {
      if (err) {
        reject(err);
      } else {
        resolve((addresses || []).map((a: dns.LookupAddress) => a.address));
      }
    });
  });

/**
 * Perform DoH lookup (simplified - would need full DNS-over-HTTPS implementation)
 */
export async function dohLookup(hostname: string): Promise<string[]> {
  if (!dohEnabled) {
    return fallbackLookup(hostname);
  }

  try {
    const dohUrl = `${DOH_PROVIDERS[dohProvider]}?name=${encodeURIComponent(hostname)}&type=A`;
    const response = await fetch(dohUrl, {
      headers: {
        Accept: 'application/dns-json',
      },
    });

    if (response.ok) {
      const data = (await response.json()) as { Answer?: Array<{ data: string }> };
      if (data.Answer && data.Answer.length > 0) {
        return data.Answer.map((answer: { data: string }) => answer.data);
      }
    } else {
      logger.warn('DoH lookup returned non-200 status', { status: response.status });
    }
  } catch (error) {
    logger.warn('DoH lookup failed, falling back to system DNS', { error });
  }

  return fallbackLookup(hostname);
}

