import { createLogger } from '../utils/logger';

const log = createLogger('regen');

export interface RegenMessage<TPayload = Record<string, unknown>> {
  type: 'research' | 'trade' | 'command' | 'heartbeat';
  payload?: TPayload;
  context?: RegenContext;
  stream?: boolean;
}

export interface RegenContext {
  sessionId?: string;
  userId?: string;
  locale?: string;
  capabilities?: string[];
}

export interface RegenResponse<TData = Record<string, unknown>> {
  type: 'result' | 'error' | 'ack';
  data: TData;
  meta?: {
    streamed?: boolean;
    sessionId?: string;
  };
}

export interface ResearchQuery {
  question: string;
  context?: string[];
  signals?: string[];
}

export interface ResearchResult {
  summary: string;
  focusAreas: string[];
  insights: Array<{ title: string; detail: string }>;
  sources: string[];
}

export interface TradeQuery {
  symbol: string;
  thesis?: string;
  timeframe?: 'scalp' | 'intraday' | 'swing' | 'long';
}

export interface TradeRecommendation {
  symbol: string;
  stance: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  suggestedAction: string;
  riskNotes: string[];
}

const FALLBACK_SOURCES = [
  'https://research.omnibrowser.ai/insight/eco-ai',
  'https://news.omnibrowser.ai/market/snapshot',
];

const signalMatch = (question: string, signals: string[] = []): string[] => {
  const normalized = question.toLowerCase();
  const matched = signals.filter(signal => normalized.includes(signal.toLowerCase()));
  return matched.length ? matched : signals.slice(0, 2);
};

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter(item => typeof item === 'string') as string[];
  return strings.length ? strings : undefined;
};

const normalizeResearchPayload = (payload: unknown): ResearchQuery => {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const question =
      typeof record.question === 'string' && record.question.trim()
        ? record.question
        : 'General research question';
    return {
      question,
      context: asStringArray(record.context),
      signals: asStringArray(record.signals),
    };
  }

  if (typeof payload === 'string' && payload.trim()) {
    return { question: payload };
  }

  return { question: 'General research question' };
};

const normalizeTradePayload = (payload: unknown): TradeQuery => {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const symbol =
      typeof record.symbol === 'string' && record.symbol.trim() ? record.symbol : 'TICKER';
    return {
      symbol,
      thesis: typeof record.thesis === 'string' ? record.thesis : undefined,
      timeframe: record.timeframe as TradeQuery['timeframe'],
    };
  }

  if (typeof payload === 'string' && payload.trim()) {
    return { symbol: payload.toUpperCase() };
  }

  return { symbol: 'TICKER' };
};

export async function handleResearchQuery(query: ResearchQuery): Promise<ResearchResult> {
  const focusAreas = signalMatch(query.question, query.signals);

  return {
    summary: `Initial research summary for "${query.question}".`,
    focusAreas,
    insights: [
      {
        title: 'Key Context',
        detail:
          (query.context && query.context[0]) ||
          'No context supplied. Provide URLs or notes for deeper synthesis.',
      },
      {
        title: 'Next Steps',
        detail:
          'Validate top sources, extract quantitative metrics, and compare against competitors.',
      },
    ],
    sources: FALLBACK_SOURCES,
  };
}

export async function handleTradeQuery(query: TradeQuery): Promise<TradeRecommendation> {
  const timeframe = query.timeframe ?? 'swing';
  const stance = query.thesis?.toLowerCase().includes('bear') ? 'bearish' : 'bullish';

  return {
    symbol: query.symbol.toUpperCase(),
    stance,
    confidence: stance === 'bullish' ? 0.64 : 0.51,
    suggestedAction:
      stance === 'bullish'
        ? `Consider staggered entries over the next ${timeframe} window.`
        : `Look for confirmation before short exposure within the ${timeframe} window.`,
    riskNotes: [
      'This is a heuristic recommendation. Validate with live market data.',
      'Position sizing should respect portfolio guardrails.',
    ],
  };
}

export function detectLanguage(text: string): { language: string; confidence: number } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { language: 'unknown', confidence: 0 };
  }

  const isEnglish = /^[\p{ASCII}]+$/u.test(trimmed);
  if (isEnglish) {
    return { language: 'en', confidence: 0.92 };
  }

  const hasSpanishTokens = /(¿|¡|ción|que|para)/i.test(trimmed);
  if (hasSpanishTokens) {
    return { language: 'es', confidence: 0.78 };
  }

  return { language: 'unknown', confidence: 0.4 };
}

export function findCommandAction(input: string): { action: string; confidence: number } {
  const normalized = input.toLowerCase();
  if (normalized.includes('research')) {
    return { action: 'research', confidence: 0.87 };
  }
  if (normalized.includes('trade')) {
    return { action: 'trade', confidence: 0.82 };
  }
  if (normalized.includes('summarize') || normalized.includes('explain')) {
    return { action: 'summarize', confidence: 0.75 };
  }
  return { action: 'command', confidence: 0.5 };
}

export const browserTools = {
  async openTab({ url }: { url: string }) {
    return { status: 'ok', action: 'openTab', url };
  },
  async captureFocus(_args: Record<string, unknown>) {
    return { status: 'ok', action: 'captureFocus' };
  },
};

export const n8nTools = {
  async triggerWorkflow({
    workflowId,
    payload,
  }: {
    workflowId: string;
    payload?: Record<string, unknown>;
  }) {
    return {
      status: 'queued',
      workflowId,
      payload,
    };
  },
};

export const searchTools = {
  async webSearch({ query }: { query: string }) {
    return {
      query,
      results: [
        { title: 'Regen placeholder result', url: FALLBACK_SOURCES[0], score: 0.62 },
        { title: 'Omni market bulletin', url: FALLBACK_SOURCES[1], score: 0.55 },
      ],
    };
  },
};

export async function handleMessage(
  message: RegenMessage
): Promise<RegenResponse<{ summary: string; data?: unknown }>> {
  if (!message?.type) {
    return {
      type: 'error',
      data: { summary: 'Invalid message: missing type' },
    };
  }

  log.debug('Handling regen message', { type: message.type, session: message.context?.sessionId });

  switch (message.type) {
    case 'research': {
      const payload = normalizeResearchPayload(message.payload);
      const result = await handleResearchQuery(payload);
      return {
        type: 'result',
        data: {
          summary: `Research ready with ${result.insights.length} insights.`,
          data: result,
        },
        meta: { streamed: Boolean(message.stream), sessionId: message.context?.sessionId },
      };
    }
    case 'trade': {
      const payload = normalizeTradePayload(message.payload);
      const result = await handleTradeQuery(payload);
      return {
        type: 'result',
        data: {
          summary: `Trade brief prepared for ${result.symbol}.`,
          data: result,
        },
        meta: { streamed: Boolean(message.stream), sessionId: message.context?.sessionId },
      };
    }
    case 'heartbeat':
      return {
        type: 'ack',
        data: { summary: 'regen-online' },
        meta: { sessionId: message.context?.sessionId },
      };
    case 'command': {
      const action = findCommandAction(String(message.payload ?? ''));
      return {
        type: 'result',
        data: { summary: `Command routed to ${action.action}`, data: action },
        meta: { sessionId: message.context?.sessionId },
      };
    }
    default:
      return {
        type: 'error',
        data: { summary: `Unsupported message type: ${message.type}` },
        meta: { sessionId: message.context?.sessionId },
      };
  }
}
