import { trackAction } from '../supermemory/tracker';

export type AITaskKind = 'search' | 'agent' | 'chat' | 'summary';

export interface AITaskLLMOptions {
  provider?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface AITaskRequest {
  kind: AITaskKind;
  prompt: string;
  context?: Record<string, unknown>;
  mode?: string;
  metadata?: Record<string, string | number | boolean>;
  llm?: AITaskLLMOptions;
  stream?: boolean;
  signal?: AbortSignal | null;
}

export interface AITaskResult {
  text: string;
  provider: string;
  model: string;
  usage?: LLMResponse['usage'];
  latency?: number;
  citations?: Array<{ title?: string; url?: string; snippet?: string; source?: string }>;
  estimated_cost_usd?: number;
}

type StreamHandler = (event: {
  type: 'token' | 'done' | 'error';
  data?: string | AITaskResult;
}) => void;

/**
 * Sprint 2 placeholder AI Engine.
 *
 * Routes all tasks through the Redix backend so langchain/tooling stays server-side.
 */
export class AIEngine {
  private readonly apiBase =
    import.meta.env.VITE_APP_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    (typeof window !== 'undefined' ? window.__OB_API_BASE__ : '');

  async runTask(request: AITaskRequest, onStream?: StreamHandler): Promise<AITaskResult> {
    if (!request.prompt?.trim()) {
      throw new Error('Prompt is required for AI tasks');
    }

    const backendResult = await this.callBackendTask(request, onStream);
    if (backendResult) {
      return backendResult;
    }

    throw new Error(
      'AI backend unavailable. Please ensure Redix Core is running and reachable.'
    );
  }

  private async callBackendTask(
    request: AITaskRequest,
    onStream?: StreamHandler
  ): Promise<AITaskResult | null> {
    if (!this.apiBase || typeof fetch === 'undefined') {
      return null;
    }
    const base = this.apiBase.replace(/\/$/, '');

    // Create AbortController with timeout (30 seconds default, 60 for streaming)
    const timeoutMs = request.stream ? 60000 : 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Combine user signal with timeout signal
    const combinedSignal = request.signal
      ? (() => {
          const combined = new AbortController();
          request.signal!.addEventListener('abort', () => combined.abort());
          controller.signal.addEventListener('abort', () => combined.abort());
          return combined.signal;
        })()
      : controller.signal;

    try {
      const response = await fetch(`${base}/api/ai/task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: request.kind,
          prompt: request.prompt,
          context: request.context,
          mode: request.mode,
          metadata: request.metadata,
          temperature: request.llm?.temperature ?? 0.2,
          max_tokens: request.llm?.maxTokens ?? 800,
        }),
        signal: combinedSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[AIEngine] Backend task failed', response.status, errorText);
        return null;
      }

      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (!reader) {
          return null;
        }
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        const tokens: string[] = [];
        while (true) {
          // Check if aborted before reading
          if (combinedSignal.aborted) {
            onStream?.({ type: 'error', data: 'Request timeout - please try again' });
            break;
          }
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';
          for (const event of events) {
            if (event.startsWith('event: error')) {
              try {
                const json = event.replace('event: error', '').replace('data:', '').trim();
                const errorPayload = JSON.parse(json) as {
                  message?: string;
                  type?: string;
                  retryable?: boolean;
                  provider?: string;
                  model?: string;
                };
                const errorMessage = errorPayload.message || 'AI service error occurred';
                onStream?.({ type: 'error', data: errorMessage });
                console.error('[AIEngine] Task error', errorPayload);
              } catch {
                // Fallback to plain text if JSON parsing fails
                const errorText = event.replace('event: error', '').replace('data:', '').trim();
                onStream?.({ type: 'error', data: errorText || 'AI service error occurred' });
              }
            } else if (event.startsWith('event: done')) {
              try {
                const json = event.replace('event: done', '').replace('data:', '').trim();
                const payload = JSON.parse(json) as AITaskResult;
                if (!payload.text) {
                  payload.text = tokens.join('');
                }
                this.trackTelemetry(payload, request);
                onStream?.({ type: 'done', data: payload });
                return payload;
              } catch (error) {
                console.warn('[AIEngine] Failed to parse done payload', error);
                onStream?.({ type: 'done', data: tokens.join('') });
                return { text: tokens.join(''), provider: 'openai', model: 'unknown' };
              }
            } else if (event.startsWith('data:')) {
              const token = event.replace('data:', '').trim();
              tokens.push(token);
              onStream?.({ type: 'token', data: token });
            }
          }
        }
        clearTimeout(timeoutId);
      }

      const data = (await response.json()) as AITaskResult;
      clearTimeout(timeoutId);
      this.trackTelemetry(data, request);
      onStream?.({ type: 'done', data: data });
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[AIEngine] Request timeout after', timeoutMs, 'ms');
        onStream?.({ type: 'error', data: 'Request timeout - please try again' });
      } else {
        console.warn('[AIEngine] Backend request error', error);
      }
      return null;
    }
  }

  private resolveSystemPrompt(request: AITaskRequest): string | undefined {
    switch (request.kind) {
      case 'search':
        return 'You are ReGen’s research copilot. Cite sources as [n].';
      case 'agent':
        return 'You are an execution agent. Be concise.';
      default:
        return undefined;
    }
  }

  private trackTelemetry(result: AITaskResult, request: AITaskRequest) {
    try {
      trackAction('ai_task_success', {
        kind: request.kind,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latency ?? null,
        promptLength: request.prompt.length,
      }).catch(() => {});
    } catch (error) {
      console.warn('[AIEngine] Failed to track telemetry', error);
    }
  }
}

export const aiEngine = new AIEngine();
