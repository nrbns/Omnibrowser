/**
 * Reranker Service - Re-rank search results using semantic similarity
 * Uses simple keyword matching or ColBERT/monoT5 if available
 */

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class RerankerService {
  /**
   * Rerank results based on query relevance
   */
  rerank(query: string, results: SearchResult[]): SearchResult[] {
    if (results.length === 0) return results;

    // Simple keyword-based reranking
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const scored = results.map(result => {
      const textLower = result.text.toLowerCase();
      let score = result.score || 0;

      // Boost score for exact phrase match
      if (textLower.includes(queryLower)) {
        score += 2.0;
      }

      // Boost for word matches
      let wordMatches = 0;
      for (const word of queryWords) {
        if (textLower.includes(word)) {
          wordMatches++;
          score += 0.5;
        }
      }

      // Normalize by query length
      score = score / (1 + queryWords.length);

      return {
        ...result,
        score,
        _wordMatches: wordMatches,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.map(({ _wordMatches, ...result }) => result);
  }

  /**
   * Rerank using BM25-like algorithm
   */
  rerankBM25(query: string, results: SearchResult[]): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 1);
    const avgDocLength = results.reduce((sum, r) => sum + r.text.length, 0) / results.length || 1;

    const scored = results.map(result => {
      const textLower = result.text.toLowerCase();
      const docLength = result.text.length;
      
      let bm25Score = 0;
      const k1 = 1.5;
      const b = 0.75;

      for (const term of queryTerms) {
        // Count term frequency in document
        const termCount = (textLower.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
        
        if (termCount > 0) {
          // Simple IDF (inverse document frequency)
          const docsWithTerm = results.filter(r => 
            r.text.toLowerCase().includes(term)
          ).length;
          const idf = Math.log((results.length - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
          
          // BM25 formula
          const numerator = termCount * (k1 + 1);
          const denominator = termCount + k1 * (1 - b + b * (docLength / avgDocLength));
          bm25Score += idf * (numerator / denominator);
        }
      }

      return {
        ...result,
        score: bm25Score + (result.score || 0),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }
}

// Singleton instance
let rerankerInstance: RerankerService | null = null;

export function getRerankerService(): RerankerService {
  if (!rerankerInstance) {
    rerankerInstance = new RerankerService();
  }
  return rerankerInstance;
}

