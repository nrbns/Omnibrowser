/**
 * Query Router - Classifies queries and routes to appropriate handlers
 * Decides: direct answer vs. browse vs. search
 */

import { getOllamaAdapter } from '../agent/ollama-adapter';

export type QueryType = 'direct_answer' | 'browse' | 'search' | 'unknown';

export interface QueryClassification {
  type: QueryType;
  confidence: number;
  reasoning?: string;
}

export class QueryRouter {
  /**
   * Classify a query to determine the best handling strategy
   */
  async classify(query: string): Promise<QueryClassification> {
    // Direct answer patterns (factual questions, calculations)
    const directAnswerPatterns = [
      /^(what|when|where|who|why|how)\s+is/i,
      /^(what|when|where|who|why|how)\s+are/i,
      /^(what|when|where|who|why|how)\s+was/i,
      /^(what|when|where|who|why|how)\s+were/i,
      /^(what|when|where|who|why|how)\s+does/i,
      /^(what|when|where|who|why|how)\s+do/i,
      /^calculate/i,
      /^convert\s+/i,
      /^\d+\s*[+\-*/]\s*\d+/, // Math expression
      /^what\s+is\s+the\s+(time|date|weather)/i,
    ];

    // Browse patterns (specific URLs or domains)
    const browsePatterns = [
      /^(https?:\/\/|www\.)/i,
      /^[a-z0-9-]+\.[a-z]{2,}/i, // Domain-like
    ];

    // Check for direct answer patterns
    for (const pattern of directAnswerPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'direct_answer',
          confidence: 0.8,
          reasoning: 'Matches direct answer pattern',
        };
      }
    }

    // Check for browse patterns
    for (const pattern of browsePatterns) {
      if (pattern.test(query)) {
        return {
          type: 'browse',
          confidence: 0.9,
          reasoning: 'Looks like a URL or domain',
        };
      }
    }

    // Try LLM-based classification if available
    try {
      const ollama = getOllamaAdapter();
      if (await ollama.checkAvailable()) {
        return await this.classifyWithLLM(query);
      }
    } catch {
      // Fall through to default
    }

    // Default: treat as search
    return {
      type: 'search',
      confidence: 0.6,
      reasoning: 'Default to search',
    };
  }

  /**
   * Classify using LLM
   */
  private async classifyWithLLM(query: string): Promise<QueryClassification> {
    try {
      const prompt = `Classify this query into one of these types:
- "direct_answer": Simple factual questions that can be answered directly (e.g., "What is the capital of France?", "Calculate 5+3")
- "browse": URLs or domain names to visit (e.g., "youtube.com", "https://example.com")
- "search": Research queries that need multiple sources (e.g., "best laptops 2024", "how to learn TypeScript")

Query: "${query}"

Respond with JSON: {"type": "direct_answer|browse|search", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt,
          stream: false,
          format: 'json',
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        const classification = JSON.parse(data.response) as QueryClassification;
        return classification;
      }
    } catch (error) {
      console.warn('[QueryRouter] LLM classification failed:', error);
    }

    // Fallback to pattern matching
    return {
      type: 'search',
      confidence: 0.5,
      reasoning: 'LLM classification failed, defaulting to search',
    };
  }
}

// Singleton instance
let routerInstance: QueryRouter | null = null;

export function getQueryRouter(): QueryRouter {
  if (!routerInstance) {
    routerInstance = new QueryRouter();
  }
  return routerInstance;
}

