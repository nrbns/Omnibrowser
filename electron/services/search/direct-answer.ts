/**
 * Direct Answer System - LLM-based direct answers for simple queries
 */

import { getOllamaAdapter } from '../agent/ollama-adapter';

export interface DirectAnswer {
  answer: string;
  confidence: number;
  sources?: string[];
}

export class DirectAnswerService {
  /**
   * Get direct answer for a simple query
   */
  async answer(query: string): Promise<DirectAnswer> {
    const ollama = getOllamaAdapter();
    const isAvailable = await ollama.checkAvailable();

    if (!isAvailable) {
      // Fallback to simple pattern matching
      return this.fallbackAnswer(query);
    }

    try {
      const prompt = `Answer this question concisely and factually:
"${query}"

Provide a brief, accurate answer. If you're not certain, say so.`;

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        return {
          answer: data.response.trim(),
          confidence: 0.7,
        };
      }
    } catch (error) {
      console.warn('[DirectAnswer] LLM answer failed:', error);
    }

    return this.fallbackAnswer(query);
  }

  /**
   * Fallback answer using simple patterns
   */
  private fallbackAnswer(query: string): DirectAnswer {
    const queryLower = query.toLowerCase();

    // Simple math
    const mathMatch = query.match(/(\d+)\s*([+\-*/])\s*(\d+)/);
    if (mathMatch) {
      const [, a, op, b] = mathMatch;
      let result = 0;
      switch (op) {
        case '+':
          result = parseInt(a) + parseInt(b);
          break;
        case '-':
          result = parseInt(a) - parseInt(b);
          break;
        case '*':
          result = parseInt(a) * parseInt(b);
          break;
        case '/':
          result = parseInt(b) !== 0 ? parseInt(a) / parseInt(b) : 0;
          break;
      }
      return {
        answer: `${result}`,
        confidence: 1.0,
      };
    }

    // Time/date queries
    if (queryLower.includes('time')) {
      return {
        answer: new Date().toLocaleTimeString(),
        confidence: 1.0,
      };
    }
    if (queryLower.includes('date')) {
      return {
        answer: new Date().toLocaleDateString(),
        confidence: 1.0,
      };
    }

    // Default fallback
    return {
      answer: `I cannot provide a direct answer to "${query}". Please try a web search instead.`,
      confidence: 0.0,
    };
  }
}

// Singleton instance
let directAnswerInstance: DirectAnswerService | null = null;

export function getDirectAnswerService(): DirectAnswerService {
  if (!directAnswerInstance) {
    directAnswerInstance = new DirectAnswerService();
  }
  return directAnswerInstance;
}

