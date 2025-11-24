/* eslint-env node */
/**
 * LLM Analysis Service
 * Supports Ollama (local) and OpenAI for content analysis
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
const LLM_PROVIDER = process.env.LLM_PROVIDER || (OPENAI_API_KEY ? 'openai' : 'ollama');
const LLM_FALLBACKS = process.env.LLM_FALLBACKS || '';

/**
 * Extract plain text from HTML
 */
function extractText(html) {
  if (!html || typeof html !== 'string') return '';
  // Simple text extraction - remove script/style tags and decode entities
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Basic HTML entity decoding
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text;
}

/**
 * Chunk text for large inputs (simple sentence-based chunking)
 */
function chunkText(text, maxChunkSize = 4000) {
  if (text.length <= maxChunkSize) return [text];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = '';
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

/**
 * Call Ollama API
 */
async function callOllama(messages, options = {}) {
  const model = options.model || OLLAMA_MODEL;
  const temperature = options.temperature ?? 0.0;
  const maxTokens = options.maxTokens ?? 4096;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      options: {
        temperature,
        num_predict: maxTokens,
      },
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    answer: data.response || '',
    model: data.model || model,
    tokensUsed: data.eval_count || 0,
  };
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages, options = {}) {
  const model = options.model || OPENAI_MODEL;
  const temperature = options.temperature ?? 0.0;
  const maxTokens = options.maxTokens ?? 2000;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  return {
    answer: choice?.message?.content || '',
    model: data.model || model,
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

/**
 * Prepare Anthropic payload
 */
function formatAnthropicMessages(messages) {
  let systemPrompt = 'You are a helpful assistant.';
  const chatMessages = [];
  for (const message of messages) {
    if (message.role === 'system') {
      if (message.content) {
        systemPrompt = message.content;
      }
      continue;
    }
    chatMessages.push({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: [
        {
          type: 'text',
          text: message.content,
        },
      ],
    });
  }
  if (chatMessages.length === 0) {
    chatMessages.push({
      role: 'user',
      content: [{ type: 'text', text: 'Provide a concise summary.' }],
    });
  }
  return { systemPrompt, chatMessages };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(messages, options = {}) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }
  const model = options.model || ANTHROPIC_MODEL;
  const temperature = options.temperature ?? 0.0;
  const maxTokens = options.maxTokens ?? 2000;
  const { systemPrompt, chatMessages } = formatAnthropicMessages(messages);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      max_tokens: maxTokens,
      temperature,
      messages: chatMessages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const contentBlocks = Array.isArray(data.content) ? data.content : [];
  const text = contentBlocks
    .map(block => {
      if (block.type === 'text') {
        return block.text;
      }
      if (Array.isArray(block.content)) {
        return block.content
          .map(part => (typeof part.text === 'string' ? part.text : ''))
          .join('\n')
          .trim();
      }
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();

  return {
    answer: text,
    model: data.model || model,
    tokensUsed: data.usage?.output_tokens || 0,
  };
}

/**
 * Build prompt for task
 */
function buildPrompt(task, question, inputText, url) {
  const baseContext = url ? `Source URL: ${url}\n\n` : '';
  const contentPreview = inputText.slice(0, 2000);

  switch (task) {
    case 'summarize':
      return {
        system: 'You are a helpful assistant that summarizes web content concisely and accurately.',
        user: `${baseContext}Content:\n${contentPreview}\n\nPlease provide a concise summary (2-3 sentences) and highlight 3-5 key points.`,
      };
    case 'qa':
      return {
        system:
          'You are a helpful assistant that answers questions based on provided content. Cite specific parts when possible.',
        user: `${baseContext}Content:\n${contentPreview}\n\nQuestion: ${question}\n\nAnswer the question based on the content above.`,
      };
    case 'threat':
      return {
        system:
          'You are a security analyst. Analyze web content for potential threats, suspicious scripts, malware indicators, and privacy risks.',
        user: `${baseContext}Content:\n${contentPreview}\n\nAnalyze this content for security threats, suspicious patterns, and privacy concerns. Provide a structured assessment.`,
      };
    default:
      return {
        system: 'You are a helpful assistant.',
        user: `${baseContext}Content:\n${contentPreview}\n\nQuestion: ${question || 'Analyze this content.'}`,
      };
  }
}

function resolveProviderOrder() {
  const preferred = [];
  const normalizedPrimary = (LLM_PROVIDER || '').trim().toLowerCase();
  if (normalizedPrimary) {
    preferred.push(normalizedPrimary);
  }
  if (LLM_FALLBACKS) {
    preferred.push(
      ...LLM_FALLBACKS.split(',')
        .map(token => token.trim().toLowerCase())
        .filter(Boolean)
    );
  }
  if (OPENAI_API_KEY) {
    preferred.push('openai');
  }
  if (ANTHROPIC_API_KEY) {
    preferred.push('anthropic');
  }
  preferred.push('ollama');

  const seen = new Set();
  return preferred.filter(provider => {
    if (seen.has(provider)) {
      return false;
    }
    seen.add(provider);
    if (provider === 'openai') {
      return Boolean(OPENAI_API_KEY);
    }
    if (provider === 'anthropic') {
      return Boolean(ANTHROPIC_API_KEY);
    }
    if (provider === 'ollama') {
      return true;
    }
    return false;
  });
}

async function invokeProvider(provider, messages, options) {
  switch (provider) {
    case 'openai':
      return callOpenAI(messages, options);
    case 'anthropic':
      return callAnthropic(messages, options);
    case 'ollama':
    default:
      return callOllama(messages, options);
  }
}

async function runWithProviderFallback(messages, options = {}) {
  const providers = resolveProviderOrder();
  const attempts = [];
  for (const provider of providers) {
    try {
      const result = await invokeProvider(provider, messages, options);
      return { result, provider, attempts };
    } catch (error) {
      attempts.push({
        provider,
        message: error?.message || 'unknown-error',
      });
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[llm] Provider ${provider} failed`, error?.message || error);
      }
    }
  }
  return { result: null, provider: null, attempts };
}

/**
 * Analyze content with LLM
 */
export async function analyzeWithLLM({
  task = 'summarize',
  inputText,
  url,
  question,
  userId: _userId,
}) {
  const startTime = Date.now();

  // Extract text if HTML
  const text = inputText?.includes('<') ? extractText(inputText) : inputText;
  if (!text || text.length < 10) {
    throw new Error('Insufficient content to analyze');
  }

  // Chunk if too large
  const chunks = chunkText(text, 4000);
  const primaryChunk = chunks[0];

  // Build prompt
  const { system, user } = buildPrompt(task, question, primaryChunk, url);

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  // Call LLM with provider fallback chain
  const { result: providerResult, provider, attempts } = await runWithProviderFallback(messages, {
    temperature: 0.0,
  });

  let llmResult = providerResult;
  let fallbackUsed = false;
  let providerName = provider || LLM_PROVIDER || 'ollama';

  if (!llmResult) {
    fallbackUsed = true;
    providerName = 'fallback';
    console.warn('[llm] All preferred LLM providers failed, using fallback summary', {
      attempts,
    });
    const fallbackAnswer =
      task === 'summarize'
        ? `Summary: ${text.slice(0, 500)}...`
        : question
          ? `Based on the content: ${text.slice(0, 300)}...`
          : `Content preview: ${text.slice(0, 500)}...`;
    llmResult = {
      answer: fallbackAnswer,
      model: 'fallback-extractor',
      tokensUsed: 0,
    };
  }

  // Extract highlights (simple sentence extraction)
  const answerLines = llmResult.answer.split('\n').filter(l => l.trim());
  const highlights = answerLines
    .filter(l => l.match(/[-•*]\s|^\d+\./))
    .slice(0, 5)
    .map(l => l.replace(/^[-•*\d.]+\s*/, '').trim());

  const latencyMs = Date.now() - startTime;

  return {
    answer: llmResult.answer.trim(),
    summary: answerLines[0] || llmResult.answer.slice(0, 200),
    highlights: highlights.length > 0 ? highlights : [llmResult.answer.slice(0, 150)],
    model: {
      name: llmResult.model,
      provider: providerName,
      temperature: 0.0,
      tokensUsed: llmResult.tokensUsed ?? 0,
      fallbackUsed,
    },
    latencyMs,
    diagnostics: {
      provider: providerName,
      fallbackUsed,
      attempts,
    },
  };
}
