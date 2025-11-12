/**
 * Hybrid Search Backend - Multi-source search aggregation
 * Combines Brave Search, Bing API, and custom crawler results
 */

export interface SearchSource {
  name: string;
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  score: number;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface HybridSearchConfig {
  sources: {
    brave: SearchSource;
    bing: SearchSource;
    custom: SearchSource;
  };
  maxResults: number;
  rerank: boolean;
}

export class HybridSearchService {
  private config: HybridSearchConfig;

  constructor(config?: Partial<HybridSearchConfig>) {
    this.config = {
      sources: {
        brave: { name: 'brave', enabled: true },
        bing: { name: 'bing', enabled: false },
        custom: { name: 'custom', enabled: true },
      },
      maxResults: 20,
      rerank: true,
      ...config,
    };
  }

  /**
   * Perform hybrid search across all enabled sources
   */
  async search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    const maxResults = options?.maxResults || this.config.maxResults;
    const results: SearchResult[] = [];

    // Search all enabled sources in parallel
    const searchPromises: Promise<SearchResult[]>[] = [];

    if (this.config.sources.brave.enabled) {
      searchPromises.push(this.searchBrave(query));
    }

    if (this.config.sources.bing.enabled && this.config.sources.bing.apiKey) {
      searchPromises.push(this.searchBing(query));
    }

    if (this.config.sources.custom.enabled) {
      searchPromises.push(this.searchCustom(query));
    }

    const sourceResults = await Promise.allSettled(searchPromises);
    
    for (const result of sourceResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      }
    }

    // Remove duplicates (by URL)
    const uniqueResults = this.deduplicate(results);

    // Rerank results
    const rankedResults = this.config.rerank
      ? await this.rerank(uniqueResults, query)
      : uniqueResults;

    // Return top N results
    return rankedResults.slice(0, maxResults);
  }

  /**
   * Search using Brave Search API
   */
  private async searchBrave(query: string): Promise<SearchResult[]> {
    const apiKey = this.config.sources.brave.apiKey || process.env.BRAVE_API_KEY;
    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'X-Subscription-Token': apiKey,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as {
        web?: {
          results?: Array<{
            title: string;
            url: string;
            description: string;
            age?: string;
          }>;
        };
      };

      if (!data.web?.results) {
        return [];
      }

      return data.web.results.map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.description,
        source: 'brave',
        score: 0.8, // Base score for Brave results
        metadata: {
          age: result.age,
        },
      }));
    } catch (error) {
      console.error('[HybridSearch] Brave search error:', error);
      return [];
    }
  }

  /**
   * Search using Bing Search API
   */
  private async searchBing(query: string): Promise<SearchResult[]> {
    const apiKey = this.config.sources.bing.apiKey || process.env.BING_API_KEY;
    const endpoint = this.config.sources.bing.endpoint || `https://api.bing.microsoft.com/v7.0/search`;

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&count=10`, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as {
        webPages?: {
          value?: Array<{
            name: string;
            url: string;
            snippet: string;
            dateLastCrawled?: string;
          }>;
        };
      };

      if (!data.webPages?.value) {
        return [];
      }

      return data.webPages.value.map(result => ({
        title: result.name,
        url: result.url,
        snippet: result.snippet,
        source: 'bing',
        score: 0.7, // Base score for Bing results
        metadata: {
          dateLastCrawled: result.dateLastCrawled,
        },
      }));
    } catch (error) {
      console.error('[HybridSearch] Bing search error:', error);
      return [];
    }
  }

  /**
   * Custom crawler-based search (uses knowledge graph + local cache)
   */
  private async searchCustom(_query: string): Promise<SearchResult[]> {
    // This would integrate with the local knowledge graph and citation graph
    // For now, return empty array (to be implemented with local search)
    try {
      // TODO: Integrate with citation-graph.ts and vector-store.ts
      // For now, return empty
      return [];
    } catch (error) {
      console.error('[HybridSearch] Custom search error:', error);
      return [];
    }
  }

  /**
   * Deduplicate results by URL
   */
  private deduplicate(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const result of results) {
      const normalizedUrl = new URL(result.url).href;
      if (!seen.has(normalizedUrl)) {
        seen.add(normalizedUrl);
        unique.push(result);
      } else {
        // If duplicate, keep the one with higher score
        const existing = unique.find(r => new URL(r.url).href === normalizedUrl);
        if (existing && result.score > existing.score) {
          const index = unique.indexOf(existing);
          unique[index] = result;
        }
      }
    }

    return unique;
  }

  /**
   * Rerank results using simple heuristics
   * In production, this would use a learned ranker or LLM-based reranking
   */
  private async rerank(results: SearchResult[], query: string): Promise<SearchResult[]> {
    // Simple keyword-based reranking
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    const scored = results.map(result => {
      let score = result.score;

      // Boost if title contains query words
      const titleLower = result.title.toLowerCase();
      for (const word of queryWords) {
        if (titleLower.includes(word)) {
          score += 0.1;
        }
      }

      // Boost if snippet contains query words
      const snippetLower = result.snippet.toLowerCase();
      for (const word of queryWords) {
        if (snippetLower.includes(word)) {
          score += 0.05;
        }
      }

      // Boost newer results
      if (result.timestamp) {
        const age = Date.now() - result.timestamp;
        const daysSince = age / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          score += 0.1; // Boost recent results
        }
      }

      // Source preference
      if (result.source === 'brave') {
        score += 0.05; // Slight preference for Brave
      }

      return {
        ...result,
        score: Math.min(1.0, score), // Cap at 1.0
      };
    });

    // Sort by score (descending)
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HybridSearchConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      sources: {
        ...this.config.sources,
        ...config.sources,
      },
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): HybridSearchConfig {
    return { ...this.config };
  }
}

// Singleton instance
let hybridSearchInstance: HybridSearchService | null = null;

export function getHybridSearchService(): HybridSearchService {
  if (!hybridSearchInstance) {
    hybridSearchInstance = new HybridSearchService();
  }
  return hybridSearchInstance;
}

