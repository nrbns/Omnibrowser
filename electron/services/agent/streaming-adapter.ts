/**
 * Streaming AI Adapter - WebSocket-based token streaming
 * Real-time AI responses like Atlas/Comet
 */

import { EventEmitter } from 'node:events';
import { getOllamaAdapter } from './ollama-adapter';

export interface StreamingConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamingChunk {
  token: string;
  finished: boolean;
  metadata?: Record<string, unknown>;
}

export class StreamingAIAdapter extends EventEmitter {
  private config: StreamingConfig;

  constructor(config: StreamingConfig) {
    super();
    this.config = config;
  }

  /**
   * Stream AI response
   */
  async *stream(query: string): AsyncGenerator<StreamingChunk> {
    const ollama = getOllamaAdapter();
    const isAvailable = await ollama.checkAvailable();

    if (!isAvailable) {
      // Fallback: simulate streaming
      yield* this.simulateStreaming(query);
      return;
    }

    // Stream from Ollama
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model || 'llama3.2',
          prompt: query,
          stream: true,
          options: {
            temperature: this.config.temperature ?? 0.7,
            num_predict: this.config.maxTokens ?? 2048,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama streaming error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          yield { token: '', finished: true };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line) as { response?: string; done?: boolean; error?: string };
            
            if (data.error) {
              throw new Error(data.error);
            }

            if (data.response) {
              const chunk: StreamingChunk = {
                token: data.response,
                finished: data.done || false,
              };
              yield chunk;
              this.emit('chunk', chunk);
            }

            if (data.done) {
              yield { token: '', finished: true };
              this.emit('done');
              return;
            }
          } catch (parseError) {
            // Invalid JSON, skip
            continue;
          }
        }
      }
    } catch (error) {
      console.error('[StreamingAI] Error:', error);
      yield { token: `Error: ${error instanceof Error ? error.message : String(error)}`, finished: true };
    }
  }

  /**
   * Simulate streaming (fallback when Ollama unavailable)
   */
  private async *simulateStreaming(text: string): AsyncGenerator<StreamingChunk> {
    const words = text.split(' ');
    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
      yield {
        token: word + ' ',
        finished: false,
      };
    }
    yield { token: '', finished: true };
  }

  /**
   * Stream with callback (alternative API)
   */
  async streamWithCallback(
    query: string,
    onChunk: (chunk: StreamingChunk) => void,
    onDone?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      for await (const chunk of this.stream(query)) {
        onChunk(chunk);
        if (chunk.finished) {
          onDone?.();
          return;
        }
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): StreamingConfig {
    return { ...this.config };
  }
}

// Factory function
export function createStreamingAdapter(config: StreamingConfig): StreamingAIAdapter {
  return new StreamingAIAdapter(config);
}

