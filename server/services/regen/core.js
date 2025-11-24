/**
 * Regen runtime for Tauri build
 * Provides lightweight research/trade helpers without Electron dependencies
 */

const FALLBACK_SOURCES = [
  'https://research.omnibrowser.ai/insight/eco-ai',
  'https://news.omnibrowser.ai/market/snapshot',
];

const sessionLanguageMap = new Map();

const signalMatch = (question = '', signals = []) => {
  if (!Array.isArray(signals) || !question) {
    return signals?.slice(0, 2) || [];
  }
  const normalized = question.toLowerCase();
  const matched = signals.filter(signal => normalized.includes(String(signal).toLowerCase()));
  return matched.length ? matched : signals.slice(0, 2);
};

const asStringArray = value => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter(item => typeof item === 'string');
  return strings.length ? strings : undefined;
};

const normalizeResearchPayload = payload => {
  if (payload && typeof payload === 'object') {
    const question =
      typeof payload.question === 'string' && payload.question.trim()
        ? payload.question
        : typeof payload.message === 'string' && payload.message.trim()
          ? payload.message
          : 'General research question';

    return {
      question,
      context: asStringArray(payload.context),
      signals: asStringArray(payload.signals),
    };
  }

  if (typeof payload === 'string' && payload.trim()) {
    return { question: payload };
  }

  return { question: 'General research question' };
};

const normalizeTradePayload = payload => {
  if (payload && typeof payload === 'object') {
    const symbol =
      typeof payload.symbol === 'string' && payload.symbol.trim()
        ? payload.symbol
        : typeof payload.message === 'string' && payload.message.trim()
          ? payload.message
          : 'TICKER';
    return {
      symbol: symbol.toUpperCase(),
      thesis: typeof payload.thesis === 'string' ? payload.thesis : undefined,
      timeframe: payload.timeframe,
    };
  }

  if (typeof payload === 'string' && payload.trim()) {
    return { symbol: payload.toUpperCase() };
  }

  return { symbol: 'TICKER' };
};

const detectLanguage = text => {
  const trimmed = typeof text === 'string' ? text.trim() : '';
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
};

const findCommandAction = input => {
  const normalized = String(input || '').toLowerCase();
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
};

const browserTools = {
  async openTab({ url }) {
    return { status: 'ok', action: 'openTab', url };
  },
  async captureFocus() {
    return { status: 'ok', action: 'captureFocus' };
  },
  async clickElement({ selector }) {
    return { status: 'ok', action: 'clickElement', selector };
  },
  async scrollTab({ amount }) {
    return { status: 'ok', action: 'scroll', amount };
  },
};

const n8nTools = {
  async triggerWorkflow({ workflowId, payload }) {
    return {
      status: 'queued',
      workflowId,
      payload,
    };
  },
};

const searchTools = {
  async webSearch({ query }) {
    return {
      query,
      results: [
        { title: 'Regen placeholder result', url: FALLBACK_SOURCES[0], score: 0.62 },
        { title: 'Omni market bulletin', url: FALLBACK_SOURCES[1], score: 0.55 },
      ],
    };
  },
};

const recordSessionLanguage = (sessionId, text) => {
  if (!sessionId || typeof sessionId !== 'string') {
    return;
  }
  const detected = detectLanguage(text);
  if (detected.language !== 'unknown') {
    sessionLanguageMap.set(sessionId, detected.language);
  }
};

const getResponseLanguage = sessionId => {
  if (!sessionId) {
    return 'en';
  }
  return sessionLanguageMap.get(sessionId) || 'en';
};

async function handleResearchQuery(query) {
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

async function handleTradeQuery(query) {
  const timeframe = query.timeframe || 'swing';
  const stance =
    query.thesis && query.thesis.toLowerCase().includes('bear') ? 'bearish' : 'bullish';

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

async function runResearchWorkflow(question) {
  const research = await handleResearchQuery(normalizeResearchPayload({ question }));
  return {
    success: true,
    data: research,
  };
}

async function handleMessage(message = {}) {
  const sessionId = message.sessionId || 'regen-session';
  const rawPrompt = message.message || message.prompt || message.text || '';
  recordSessionLanguage(sessionId, rawPrompt);

  const intent = (message.mode || message.intent || '').toLowerCase();
  const normalizedPayload =
    intent === 'trade' ? normalizeTradePayload(message) : normalizeResearchPayload(message);

  if (intent === 'trade') {
    const trade = await handleTradeQuery(normalizedPayload);
    return {
      intent: 'trade',
      text: `Trade brief for ${trade.symbol}: stance ${trade.stance} with ${Math.round(trade.confidence * 100)}% confidence.`,
      data: trade,
      commands: [],
    };
  }

  const research = await handleResearchQuery(normalizedPayload);
  return {
    intent: 'research',
    text: research.summary,
    data: research,
    commands: [],
  };
}

module.exports = {
  handleMessage,
  handleResearchQuery,
  handleTradeQuery,
  runResearchWorkflow,
  browserTools,
  n8nTools,
  searchTools,
  detectLanguage,
  findCommandAction,
  getResponseLanguage,
};
