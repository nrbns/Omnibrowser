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
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

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
    provider: 'ollama',
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
    provider: 'openai',
  };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(messages, options = {}) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key missing');
  }

  const model = options.model || ANTHROPIC_MODEL;
  const temperature = options.temperature ?? 0.0;
  const maxTokens = options.maxTokens ?? 2000;

  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const userMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      system: systemMessage,
      messages: userMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = Array.isArray(data.content)
    ? data.content.map(chunk => chunk?.text || '').join('\n')
    : '';

  return {
    answer: content,
    model,
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    provider: 'anthropic',
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

  // Call LLM
  const providerChain = [
    OPENAI_API_KEY && { name: 'openai', runner: () => callOpenAI(messages, { temperature: 0.0 }) },
    ANTHROPIC_API_KEY && {
      name: 'anthropic',
      runner: () => callAnthropic(messages, { temperature: 0.0 }),
    },
    { name: 'ollama', runner: () => callOllama(messages, { temperature: 0.0 }) },
  ].filter(Boolean);

  let llmResult = null;
  let lastError = null;

  for (const provider of providerChain) {
    try {
      llmResult = await provider.runner();
      break;
    } catch (error) {
      lastError = error;
      console.warn(`[llm] ${provider.name} provider failed`, error);
    }
  }

  if (!llmResult) {
    // Fallback to simple extraction if all LLMs fail
    console.warn('[llm] All providers failed, using fallback', lastError);
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
      provider: 'fallback',
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
      provider: llmResult.provider || 'unknown',
      temperature: 0.0,
      tokensUsed: llmResult.tokensUsed,
    },
    latencyMs,
  };
}
