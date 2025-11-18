import { semanticSearchMemories } from '../supermemory/search';
import { processMemoryEvent } from '../supermemory/pipeline';
import type { AgentTool } from './types';
import { dispatch } from '../redix/runtime';

async function defaultRedixAsk(prompt: string): Promise<string> {
  try {
    const response = await dispatch({
      type: 'redix:agent:query',
      payload: { prompt },
      source: 'agent-runtime',
    });
    return (response as any)?.payload?.text || '';
  } catch (error) {
    console.warn('[AgentTools] redixAsk failed:', error);
    return '';
  }
}

async function defaultFetch(url: string, init?: RequestInit) {
  const safeUrl = new URL(url);
  if (!['http:', 'https:'].includes(safeUrl.protocol)) {
    throw new Error('Only http/https allowed');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(safeUrl.toString(), {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': 'RedixAgent/1.0',
        ...(init?.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export const agentTools: Record<string, AgentTool> = {
  'memory.search': {
    id: 'memory.search',
    description: 'Search personal SuperMemory for relevant context.',
    requiredCapabilities: ['memory:read'],
    async run(input, _ctx) {
      const query = String(input.query || input.prompt || '');
      if (!query) return [];
      const results = await semanticSearchMemories(query, { limit: Number(input.limit) || 8 });
      return results.map((result) => ({
        id: result.event.id,
        similarity: result.similarity,
        title: result.event.metadata?.title,
        url: result.event.metadata?.url,
        tags: result.event.metadata?.tags,
        snippet: result.chunkText,
      }));
    },
  },
  'memory.saveNote': {
    id: 'memory.saveNote',
    description: 'Save a note to SuperMemory',
    requiredCapabilities: ['memory:write'],
    async run(input, _ctx) {
      const value = String(input.title || input.prompt || input.text || '');
      if (!value) throw new Error('Note text required');
      const eventId = await processMemoryEvent({
        type: 'note',
        value,
        metadata: {
          url: input.url ? String(input.url) : undefined,
          notePreview: String(input.text || value).slice(0, 280),
          tags: Array.isArray(input.tags) ? input.tags.map(String) : undefined,
        },
      }).then((res) => res.eventId);
      return { eventId };
    },
  },
  'redix.ask': {
    id: 'redix.ask',
    description: 'Ask the Redix core workflow for an answer.',
    requiredCapabilities: ['redix:ask'],
    async run(input, ctx) {
      const prompt = String(input.prompt || input.query || '');
      if (!prompt) return '';
      const answer = await (ctx?.redixAsk ? ctx.redixAsk(prompt) : defaultRedixAsk(prompt));
      return answer;
    },
  },
  'web.fetch': {
    id: 'web.fetch',
    description: 'Make a safe HTTP GET request for public data.',
    requiredCapabilities: ['web:fetch'],
    async run(input, ctx) {
      const url = String(input.url);
      const response = await (ctx.safeFetch || defaultFetch)(url);
      const text = await response.text();
      const headerPairs: Array<[string, string]> = [];
      response.headers.forEach((value: string, key: string) => {
        headerPairs.push([key, value]);
      });
      return {
        status: response.status,
        headers: Object.fromEntries(headerPairs),
        text,
      };
    },
  },
  'trade.fetchQuote': {
    id: 'trade.fetchQuote',
    description: 'Fetch real-time stock quote data for a symbol (e.g., AAPL, TSLA).',
    requiredCapabilities: ['web:fetch'],
    async run(input, _ctx) {
      const symbol = String(input.symbol || '').toUpperCase();
      if (!symbol) throw new Error('Stock symbol required');
      
      try {
        const { fetchTradeQuote } = await import('../trade/dataService');
        const quote = await fetchTradeQuote(symbol);
        return {
          symbol: quote.symbol,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          sentiment: quote.sentiment,
          updatedAt: quote.updatedAt,
        };
      } catch (error) {
        console.warn('[AgentTools] trade.fetchQuote failed:', error);
        throw new Error(`Failed to fetch quote for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },
  'image.search': {
    id: 'image.search',
    description: 'Search for images based on a query. Returns image URLs and metadata.',
    requiredCapabilities: ['web:fetch'],
    async run(input, _ctx) {
      const query = String(input.query || input.prompt || '');
      if (!query) throw new Error('Image search query required');
      
      // For now, use a mock/placeholder implementation
      // In production, this would call an image search API
      try {
        const { MockImageEngine } = await import('../../modes/images/engines');
        const engine = new MockImageEngine();
        const imageUrls = engine.generate(query);
        return {
          query,
          images: imageUrls.map((url, idx) => ({
            url,
            index: idx,
            thumbnail: url,
          })),
          count: imageUrls.length,
        };
      } catch (error) {
        console.warn('[AgentTools] image.search failed:', error);
        return {
          query,
          images: [],
          count: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },
  'threat.scan': {
    id: 'threat.scan',
    description: 'Scan a URL for security threats, vulnerabilities, and malware indicators.',
    requiredCapabilities: ['web:fetch'],
    async run(input, ctx) {
      const url = String(input.url || '');
      if (!url) throw new Error('URL required for threat scan');
      
      try {
        // Try IPC threat scan if available
        const scanResult = await (window as any).api?.threats?.scanUrl?.(url);
        if (scanResult) {
          return scanResult;
        }
        
        // Fallback: Basic security check via fetch
        try {
          const response = await ((ctx as any).safeFetch || defaultFetch)(url, {
            method: 'HEAD',
          });
          
          return {
            url,
            riskLevel: response.status >= 400 ? 'high' : 'medium',
            threats: [
              {
                type: 'HTTP Status Check',
                severity: response.status >= 400 ? 'high' : 'low',
                description: `HTTP status: ${response.status}`,
                recommendation: response.status >= 400 ? 'URL returned an error status' : 'URL is accessible',
              },
            ],
            scannedAt: Date.now(),
          };
        } catch {
          return {
            url,
            riskLevel: 'high',
            threats: [
              {
                type: 'Connection Error',
                severity: 'high',
                description: 'Failed to connect to URL',
                recommendation: 'URL may be unreachable or blocked',
              },
            ],
            scannedAt: Date.now(),
          };
        }
      } catch (error) {
        console.warn('[AgentTools] threat.scan failed:', error);
        throw new Error(`Threat scan failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },
  'graph.query': {
    id: 'graph.query',
    description: 'Query the knowledge graph for nodes, edges, and relationships.',
    requiredCapabilities: ['memory:read'],
    async run(input, _ctx) {
      const query = String(input.query || input.prompt || '');
      if (!query) throw new Error('Graph query required');
      
      try {
        // Search SuperMemory for related content
        const memoryResults = await semanticSearchMemories(query, { limit: 10 });
        
        // Try to get graph data from IPC if available
        const graphData = await (window as any).api?.graph?.all?.();
        
        // Build graph nodes from memory results
        const nodes = memoryResults.map((result) => ({
          key: result.event.id,
          title: result.event.metadata?.title || result.event.value?.slice(0, 50),
          type: result.event.type,
          similarity: result.similarity,
        }));
        
        // Build edges from relationships (simplified)
        const edges: Array<{ src: string; dst: string; rel?: string }> = [];
        for (let i = 0; i < nodes.length - 1; i++) {
          if (nodes[i].similarity && nodes[i + 1].similarity && nodes[i].similarity > 0.7) {
            edges.push({
              src: nodes[i].key,
              dst: nodes[i + 1].key,
              rel: 'related',
            });
          }
        }
        
        return {
          query,
          nodes: graphData?.nodes || nodes,
          edges: graphData?.edges || edges,
          nodeCount: (graphData?.nodes || nodes).length,
          edgeCount: (graphData?.edges || edges).length,
        };
      } catch (error) {
        console.warn('[AgentTools] graph.query failed:', error);
        return {
          query,
          nodes: [],
          edges: [],
          nodeCount: 0,
          edgeCount: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },
  'doc.summarize': {
    id: 'doc.summarize',
    description: 'Summarize a document or text content. Extracts key points and main ideas.',
    requiredCapabilities: ['redix:ask'],
    async run(input, ctx) {
      const text = String(input.text || input.content || '');
      const url = input.url ? String(input.url) : undefined;
      
      if (!text && !url) throw new Error('Text content or URL required');
      
      try {
        let content = text;
        
        // If URL provided, fetch content
        if (url && !text) {
          const response = await ((ctx as any).safeFetch || defaultFetch)(url);
          content = await response.text();
        }
        
        // Use Redix to summarize
        const summaryPrompt = `Summarize the following document. Provide:
1. Key points (3-5 bullet points)
2. Main ideas
3. Important details

Document:
${content.slice(0, 4000)}`; // Limit to 4000 chars
        
        const summary = await ((ctx as any).redixAsk ? (ctx as any).redixAsk(summaryPrompt) : defaultRedixAsk(summaryPrompt));
        
        return {
          summary,
          keyPoints: summary.split('\n').filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('•')),
          wordCount: content.split(/\s+/).length,
          url,
        };
      } catch (error) {
        console.warn('[AgentTools] doc.summarize failed:', error);
        throw new Error(`Document summarization failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },
};


