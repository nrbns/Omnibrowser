/* eslint-env node */
// @ts-check

import { runSearch } from '../../redix-search.js';

/**
 * Execute a lightweight search query via the existing search runner.
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<Array<{ title: string; url: string; snippet?: string }>>}
 */
export async function searchWeb(query, limit = 3) {
  if (!query?.trim()) {
    return [];
  }

  try {
    const results = await runSearch(query.trim(), { limit });
    if (!Array.isArray(results)) {
      return [];
    }
    return results.slice(0, limit).map(result => ({
      title: result.title || result.url || 'Untitled',
      url: result.url,
      snippet: result.snippet || result.summary || '',
    }));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[RegenSearch] searchWeb failed', error?.message || error);
    }
    return [];
  }
}

export function summarizeSearchResults(results) {
  if (!results.length) {
    return 'No relevant sources were discovered.';
  }

  return results
    .map((result, index) => `${index + 1}. ${result.title} — ${result.snippet || result.url}`)
    .join('\n');
}
