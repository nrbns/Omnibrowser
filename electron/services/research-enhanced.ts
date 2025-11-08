/**
 * Enhanced Research Mode Service
 * Multi-source retrieval, parallel fetching, source voting, summarization with citations
 */

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { randomUUID } from 'node:crypto';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { verifyResearchResult, VerificationResult } from './research-verifier';
import { getHybridSearchService, SearchResult as HybridSearchResult } from './search/hybrid-search';
import { stealthFetchPage } from './stealth-fetch';
import { fetch } from 'undici';

export interface ResearchSource {
  url: string;
  title: string;
  text: string;
  snippet: string;
  timestamp?: number;
  domain: string;
  relevanceScore: number;
  sourceType: 'news' | 'academic' | 'documentation' | 'forum' | 'other';
  metadata?: Record<string, unknown>;
}

export interface ResearchResult {
  query: string;
  sources: ResearchSource[];
  summary: string;
  citations: Array<{
    index: number;
    sourceIndex: number;
    quote: string;
    confidence: number;
  }>;
  confidence: number;
  contradictions?: Array<{
    claim: string;
    sources: number[];
    disagreement: 'minor' | 'major';
  }>;
  verification?: VerificationResult;
}

const CACHE_TTL = 3600000; // 1 hour
const contentCache = new Map<string, { content: ResearchSource; timestamp: number }>();

interface ScoreWeights {
  recencyWeight: number;
  authorityWeight: number;
}

/**
 * Extract domain from URL
 */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Classify source type based on URL/domain
 */
function classifySourceType(url: string, title: string): ResearchSource['sourceType'] {
  const domain = getDomain(url).toLowerCase();
  const titleLower = title.toLowerCase();
  
  if (domain.includes('arxiv.org') || domain.includes('pubmed') || domain.includes('.edu') || domain.includes('scholar')) {
    return 'academic';
  }
  if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn') || domain.includes('reuters')) {
    return 'news';
  }
  if (domain.includes('docs') || domain.includes('github.io') || domain.includes('readthedocs')) {
    return 'documentation';
  }
  if (domain.includes('reddit') || domain.includes('stackoverflow') || domain.includes('forum')) {
    return 'forum';
  }
  return 'other';
}

/**
 * Fetch readable content from URL (with caching)
 */
function normalizeUrl(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

function parseMetadataTimestamp(meta?: HybridSearchResult): number | undefined {
  if (!meta) return undefined;
  if (typeof meta.timestamp === 'number') {
    return meta.timestamp;
  }
  const metadata = meta.metadata as Record<string, unknown> | undefined;
  const crawl = metadata?.dateLastCrawled;
  if (typeof crawl === 'string' && !Number.isNaN(Date.parse(crawl))) {
    return Date.parse(crawl);
  }
  const age = metadata?.age;
  if (typeof age === 'string') {
    const match = age.match(/(\d+)\s*(d|day|days|h|hr|hour|hours|m|min|minute|minutes)/i);
    if (match) {
      const value = Number(match[1]);
      const unit = match[2].toLowerCase();
      if (!Number.isNaN(value)) {
        const now = Date.now();
        if (unit.startsWith('d')) {
          return now - value * 24 * 60 * 60 * 1000;
        }
        if (unit.startsWith('h')) {
          return now - value * 60 * 60 * 1000;
        }
        if (unit.startsWith('m')) {
          return now - value * 60 * 1000;
        }
      }
    }
  }
  return undefined;
}

async function fetchReadable(target: string, timeout = 10000, meta?: HybridSearchResult): Promise<ResearchSource | null> {
  const normalizedTarget = normalizeUrl(target);

  // Check cache
  const cached = contentCache.get(normalizedTarget);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (meta) {
      cached.content.metadata = { ...(meta.metadata || {}), source: meta.source, score: meta.score };
      if (meta.snippet) {
        cached.content.snippet = meta.snippet;
      }
      const parsedTimestamp = parseMetadataTimestamp(meta);
      if (parsedTimestamp) {
        cached.content.timestamp = parsedTimestamp;
      }
    }
    return cached.content;
  }

  const stealthResult = await stealthFetchPage(target, { timeout }).catch(() => null);

  try {
    if (!stealthResult) {
      throw new Error('Stealth fetch failed');
    }

    const effectiveUrl = normalizeUrl(stealthResult.finalUrl || target);
    const dom = new JSDOM(stealthResult.html, { url: effectiveUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) return null;
    const text = (article.textContent || '').replace(/[\t\r]+/g, ' ').trim();
    const title = article.title || stealthResult.title || dom.window.document.title || effectiveUrl;
    const defaultSnippet = text.slice(0, 200) + (text.length > 200 ? '...' : '');
    const snippet = meta?.snippet?.trim() ? meta.snippet.trim() : defaultSnippet;
    const timestamp = parseMetadataTimestamp(meta) ?? Date.now();

    const source: ResearchSource = {
      url: effectiveUrl,
      title,
      text,
      snippet,
      timestamp,
      domain: getDomain(effectiveUrl),
      relevanceScore: 0,
      sourceType: classifySourceType(target, title),
      metadata: meta ? { ...(meta.metadata || {}), source: meta.source, score: meta.score } : undefined,
    };

    // Cache result
    const cacheEntry = { content: source, timestamp: Date.now() };
    contentCache.set(effectiveUrl, cacheEntry);
    if (effectiveUrl !== normalizedTarget) {
      contentCache.set(normalizedTarget, cacheEntry);
    }

    return source;
  } catch (error) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(target, {
        headers: { 'User-Agent': 'OmniBrowserBot/1.0' },
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);
      if (!res || !res.ok) return null;

      const html = await res.text();
      const dom = new JSDOM(html, { url: target });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) return null;
      const text = (article.textContent || '').replace(/[\t\r]+/g, ' ').trim();
      const title = article.title || dom.window.document.title || target;
      const defaultSnippet = text.slice(0, 200) + (text.length > 200 ? '...' : '');
      const snippet = meta?.snippet?.trim() ? meta.snippet.trim() : defaultSnippet;
      const timestamp = parseMetadataTimestamp(meta) ?? Date.now();

      const source: ResearchSource = {
        url: target,
        title,
        text,
        snippet,
        timestamp,
        domain: getDomain(target),
        relevanceScore: 0,
        sourceType: classifySourceType(target, title),
        metadata: meta ? { ...(meta.metadata || {}), source: meta.source, score: meta.score } : undefined,
      };

      contentCache.set(normalizedTarget, { content: source, timestamp: Date.now() });
      return source;
    } catch (fallbackError) {
      console.warn('[Research] Failed to fetch readable content:', fallbackError);
      return null;
    }
  }
}

/**
 * Parallel fetch multiple URLs
 */
async function fetchMultipleParallel(
  urls: string[],
  metadataMap?: Map<string, HybridSearchResult>,
  maxConcurrent = 5
): Promise<ResearchSource[]> {
  const results: ResearchSource[] = [];
  const chunks: string[][] = [];
  
  // Split into chunks for parallel fetching
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    chunks.push(urls.slice(i, i + maxConcurrent));
  }
  
  for (const chunk of chunks) {
    const promises = chunk.map(url => {
      const meta = metadataMap?.get(normalizeUrl(url));
      return fetchReadable(url, 10000, meta);
    });
    const chunkResults = await Promise.allSettled(promises);
    
    for (const result of chunkResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }
  
  return results;
}

/**
 * Search multiple engines in parallel
 */
async function searchMultipleEngines(
  query: string,
  maxResults = 12,
  region?: string
): Promise<{ urls: string[]; metadata: Map<string, HybridSearchResult> }> {
  const urls: string[] = [];
  const metadata = new Map<string, HybridSearchResult>();
  const finalQuery = region && region.trim().length > 0 && region.toLowerCase() !== 'global'
    ? `${query} ${region}`
    : query;

  try {
    const hybrid = getHybridSearchService();
    const hybridResults = await hybrid.search(finalQuery, { maxResults });
    for (const result of hybridResults) {
      const norm = normalizeUrl(result.url);
      if (!metadata.has(norm)) {
        metadata.set(norm, result);
        urls.push(result.url);
      }
    }
  } catch (error) {
    console.warn('[Research] Hybrid search failed:', error);
  }

  // Fallback to DuckDuckGo if we still need more URLs
  if (urls.length < maxResults) {
    try {
      const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(finalQuery)}`;
      const res = await fetch(ddgUrl, { headers: { 'User-Agent': 'OmniBrowserBot/1.0' } });
      const html = await res.text();
      const links = Array.from(html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/g))
        .map(m => m[1])
        .filter(Boolean);
      for (const link of links) {
        const norm = normalizeUrl(link);
        if (!metadata.has(norm)) {
          metadata.set(norm, {
            title: link,
            url: link,
            snippet: '',
            source: 'duckduckgo',
            score: 0.5,
          } as HybridSearchResult);
          urls.push(link);
          if (urls.length >= maxResults) break;
        }
      }
    } catch (error) {
      console.warn('DuckDuckGo search failed:', error);
    }
  }

  return {
    urls: urls.slice(0, maxResults),
    metadata,
  };
}

/**
 * Calculate relevance score for a source
 */
function calculateRelevanceScore(source: ResearchSource, query: string, weights: ScoreWeights): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const textLower = source.text.toLowerCase();
  const titleLower = source.title.toLowerCase();
  
  let score = 0;
  
  // Title matches are more important
  for (const term of queryTerms) {
    if (titleLower.includes(term)) score += 5;
    if (textLower.includes(term)) score += 1;
  }
  
  const authorityMultiplier = 1 + Math.max(0, Math.min(1, weights.authorityWeight));
  switch (source.sourceType) {
    case 'academic':
      score += 10 * authorityMultiplier;
      break;
    case 'documentation':
      score += 6 * authorityMultiplier;
      break;
    case 'news':
      score += 4 * authorityMultiplier * 0.8;
      break;
    default:
      break;
  }
  
  const recencyMultiplier = 1 + Math.max(0, Math.min(1, weights.recencyWeight));
  if (source.timestamp) {
    const ageMs = Date.now() - source.timestamp;
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    const recencyScore = Math.max(0, 1 - Math.min(ageDays, 90) / 90); // 0..1
    score += recencyScore * 10 * recencyMultiplier;
  }
  
  if (source.metadata && typeof source.metadata.score === 'number') {
    score += Number(source.metadata.score) * 10;
  }
  
  // Penalize very short content
  if (source.text.length < 100) score -= 5;
  
  return Math.max(0, score);
}

/**
 * Extract relevant snippets from text
 */
function extractSnippets(text: string, query: string, maxSnippets = 3): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 20);
  
  const scored = sentences.map(s => ({
    sentence: s,
    score: terms.reduce((acc, term) => {
      const count = (s.toLowerCase().match(new RegExp(term, 'g')) || []).length;
      return acc + count;
    }, 0),
  })).filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSnippets)
    .map(x => x.sentence.trim());
  
  return scored;
}

/**
 * Source voting mechanism - rank sources by consensus
 */
function voteOnSources(sources: ResearchSource[], query: string, weights: ScoreWeights): ResearchSource[] {
  // Calculate relevance scores
  for (const source of sources) {
    source.relevanceScore = calculateRelevanceScore(source, query, weights);
  }
  
  // Sort by relevance score
  const ranked = sources.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Diversify by source type (prefer mix of news, academic, docs)
  const diversified: ResearchSource[] = [];
  const typeCounts: Record<ResearchSource['sourceType'], number> = {
    news: 0,
    academic: 0,
    documentation: 0,
    forum: 0,
    other: 0,
  };
  
  const maxPerType = Math.ceil(ranked.length / 3); // Allow up to 1/3 of each type
  
  for (const source of ranked) {
    if (typeCounts[source.sourceType] < maxPerType || diversified.length < 5) {
      diversified.push(source);
      typeCounts[source.sourceType]++;
    }
  }
  
  // Fill remaining slots with highest ranked
  for (const source of ranked) {
    if (!diversified.includes(source) && diversified.length < ranked.length) {
      diversified.push(source);
    }
  }
  
  return diversified.slice(0, 12); // Return top 12
}

/**
 * Detect contradictions between sources
 */
function detectContradictions(sources: ResearchSource[], query: string): ResearchResult['contradictions'] {
  if (sources.length < 2) return undefined;

  const contradictions: ResearchResult['contradictions'] = [];
  const keyTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 3);

  const polarityPairs = [
    { positive: /\b(increase|higher|growth|rise|support|approve)\b/gi, negative: /\b(decrease|lower|drop|decline|oppose|reject)\b/gi },
    { positive: /\b(success|effective|works|beneficial|advantage)\b/gi, negative: /\b(fail|ineffective|harmful|risk|drawback)\b/gi },
    { positive: /\b(accurate|reliable|confirmed|proven)\b/gi, negative: /\b(doubt|disputed|questioned|uncertain)\b/gi },
  ];

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const source1 = sources[i];
      const source2 = sources[j];
      const text1 = source1.text.toLowerCase();
      const text2 = source2.text.toLowerCase();

      const sharedTerms = keyTerms.filter(term => text1.includes(term) && text2.includes(term));
      if (sharedTerms.length === 0) continue;

      let severityScore = 0;
      let summary: string | undefined;

      for (const pair of polarityPairs) {
        const pos1 = (source1.text.match(pair.positive) || []).length;
        const neg1 = (source1.text.match(pair.negative) || []).length;
        const pos2 = (source2.text.match(pair.positive) || []).length;
        const neg2 = (source2.text.match(pair.negative) || []).length;

        const polarity1 = pos1 - neg1;
        const polarity2 = pos2 - neg2;

        if (polarity1 === 0 || polarity2 === 0) continue;

        if (polarity1 > 0 && polarity2 < 0) {
          severityScore += Math.abs(polarity1) + Math.abs(polarity2);
          summary = `${source1.domain} reports positive findings while ${source2.domain} reports concerns.`;
        } else if (polarity1 < 0 && polarity2 > 0) {
          severityScore += Math.abs(polarity1) + Math.abs(polarity2);
          summary = `${source1.domain} highlights risks that ${source2.domain} disputes.`;
        }
      }

      if (severityScore > 0) {
        contradictions.push({
          claim: sharedTerms.slice(0, 3).join(', '),
          sources: [i, j],
          disagreement: severityScore > 6 ? 'major' : 'minor',
          summary,
          severityScore,
        });
      }
    }
  }

  return contradictions.length > 0 ? contradictions : undefined;
}

/**
 * Generate summary with citations (simplified - would use LLM in production)
 */
function generateSummaryWithCitations(sources: ResearchSource[], query: string): {
  summary: string;
  citations: ResearchResult['citations'];
  confidence: number;
} {
  if (sources.length === 0) {
    return {
      summary: `No sources found for query: ${query}`,
      citations: [],
      confidence: 0,
    };
  }
  
  // Extract relevant snippets from top sources
  const topSources = sources.slice(0, 5);
  const allSnippets: Array<{ snippet: string; sourceIndex: number; quote: string }> = [];
  
  for (let i = 0; i < topSources.length; i++) {
    const source = topSources[i];
    const snippets = extractSnippets(source.text, query, 2);
    
    for (const snippet of snippets) {
      allSnippets.push({
        snippet,
        sourceIndex: i,
        quote: snippet.slice(0, 100),
      });
    }
  }
  
  // Build summary from snippets (simplified - would use LLM in production)
  const summaryParts = allSnippets.slice(0, 5).map((s, idx) => {
    return `[${idx + 1}] ${s.snippet}`;
  });
  
  const summary = summaryParts.join('\n\n');
  
  // Generate citations
  const citations = allSnippets.slice(0, 10).map((s, idx) => ({
    index: idx + 1,
    sourceIndex: s.sourceIndex,
    quote: s.quote,
    confidence: Math.min(1.0, sources[s.sourceIndex].relevanceScore / 20), // Normalize confidence
  }));
  
  // Calculate overall confidence based on source quality and quantity
  const avgRelevance = sources.slice(0, 5).reduce((acc, s) => acc + s.relevanceScore, 0) / Math.min(5, sources.length);
  const confidence = Math.min(1.0, (avgRelevance / 20) * (sources.length / 5));
  
  return {
    summary,
    citations,
    confidence: Math.max(0.3, confidence), // Minimum 30% confidence
  };
}

function createTextFragment(snippet: string): string {
  const sanitized = snippet.replace(/\s+/g, ' ').trim();
  if (!sanitized) return '';

  const start = sanitized.slice(0, 80);
  const end = sanitized.length > 120 ? sanitized.slice(-80) : '';
  const encode = (text: string) => encodeURIComponent(text.replace(/%/g, '').slice(0, 80));

  if (end) {
    return `#:~:text=${encode(start)},${encode(end)}`;
  }
  return `#:~:text=${encode(start)}`;
}

function buildEvidence(sources: ResearchSource[], query: string): ResearchResult['evidence'] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const evidence: NonNullable<ResearchResult['evidence']> = [];

  sources.slice(0, 6).forEach((source, sourceIndex) => {
    const snippets = extractSnippets(source.text, query, 3);
    snippets.forEach((snippet) => {
      const score = terms.reduce((acc, term) => acc + (snippet.toLowerCase().includes(term) ? 1 : 0), 0);
      const importance = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
      const fragment = createTextFragment(snippet);

      evidence.push({
        id: randomUUID(),
        sourceIndex,
        quote: snippet.trim(),
        context: `${source.title} • ${source.domain}`,
        importance,
        fragmentUrl: fragment ? `${source.url}${fragment}` : source.url,
      });
    });
  });

  return evidence.length > 0 ? evidence : undefined;
}

function buildBiasProfile(sources: ResearchSource[], weights: ScoreWeights): ResearchResult['biasProfile'] {
  if (sources.length === 0) return undefined;

  const counts: Record<ResearchSource['sourceType'], number> = {
    news: 0,
    academic: 0,
    documentation: 0,
    forum: 0,
    other: 0,
  };

  sources.forEach((source) => {
    counts[source.sourceType] += 1;
  });

  const total = sources.length || 1;
  const domainMix = (Object.keys(counts) as ResearchSource['sourceType'][]).map((type) => ({
    type,
    percentage: Math.round((counts[type] / total) * 100),
  }));

  return {
    authorityBias: Math.round(weights.authorityWeight * 100),
    recencyBias: Math.round(weights.recencyWeight * 100),
    domainMix,
  };
}

function buildTaskChains(result: ResearchResult): ResearchResult['taskChains'] {
  const chains: ResearchResult['taskChains'] = [];
  const primarySteps = [
    {
      id: randomUUID(),
      title: 'Review AI synthesis',
      description: 'Skim the generated answer and note the cited claims.',
      status: 'in_progress' as const,
    },
  ];

  if (result.evidence && result.evidence.length > 0) {
    const evidence = result.evidence[0];
    primarySteps.push({
      id: randomUUID(),
      title: 'Verify primary evidence',
      description: 'Open the highlighted passage on the original page to confirm context.',
      status: 'pending' as const,
      action: {
        type: 'openEvidence',
        sourceIndex: evidence.sourceIndex,
        evidenceId: evidence.id,
        fragmentUrl: evidence.fragmentUrl,
      },
    });
  }

  if (result.contradictions && result.contradictions.length > 0) {
    primarySteps.push({
      id: randomUUID(),
      title: 'Resolve conflicting sources',
      description: 'Compare sources with opposing conclusions and record takeaways.',
      status: 'pending' as const,
      action: {
        type: 'openSource',
        sourceIndex: result.contradictions[0].sources[0],
      },
    });
  }

  primarySteps.push({
    id: randomUUID(),
    title: 'Capture final summary',
    description: 'Document the reconciled answer with citations.',
    status: 'pending' as const,
  });

  chains.push({
    id: randomUUID(),
    label: 'Verify and Synthesize',
    steps: primarySteps,
  });

  if (result.sources.length > 4) {
    chains.push({
      id: randomUUID(),
      label: 'Source Deep Dive',
      steps: result.sources.slice(0, 4).map((source, idx) => ({
        id: randomUUID(),
        title: `Audit source #${idx + 1}`,
        description: `${source.title} (${source.domain})`,
        status: 'pending' as const,
        action: {
          type: 'openSource',
          sourceIndex: idx,
        },
      })),
    });
  }

  return chains;
}

/**
 * Main research query handler
 */
export async function researchQuery(
  query: string,
  options?: {
    maxSources?: number;
    includeCounterpoints?: boolean;
    region?: string;
    recencyWeight?: number;
    authorityWeight?: number;
  }
): Promise<ResearchResult> {
  const maxSources = options?.maxSources || 12;
  const weights: ScoreWeights = {
    recencyWeight: options?.recencyWeight !== undefined ? Math.max(0, Math.min(1, options.recencyWeight)) : 0.5,
    authorityWeight: options?.authorityWeight !== undefined ? Math.max(0, Math.min(1, options.authorityWeight)) : 0.5,
  };
  
  // Step 1: Search multiple engines in parallel
  const { urls, metadata } = await searchMultipleEngines(query, maxSources, options?.region);
  
  // Step 2: Fetch content in parallel
  const sources = await fetchMultipleParallel(urls, metadata, 5);
  
  if (sources.length === 0) {
    return {
      query,
      sources: [],
      summary: `No sources found for query: ${query}`,
      citations: [],
      confidence: 0,
    };
  }
  
  // Step 3: Vote on sources (rank and diversify)
  const rankedSources = voteOnSources(sources, query, weights);
  
  // Step 4: Generate summary with citations
  const { summary, citations, confidence } = generateSummaryWithCitations(rankedSources, query);
  
  // Step 5: Detect contradictions
  const contradictions = options?.includeCounterpoints
    ? detectContradictions(rankedSources, query)
    : undefined;
  
  // Step 6: Verify result (second pass)
  const result: ResearchResult = {
    query,
    sources: rankedSources,
    summary,
    citations,
    confidence,
    contradictions,
  };
  
  // Run verification
  const verification = verifyResearchResult(result);
  result.verification = verification;
  result.evidence = buildEvidence(rankedSources, query);
  result.biasProfile = buildBiasProfile(rankedSources, weights);
  result.taskChains = buildTaskChains(result);
  
  return result;
}

/**
 * Register IPC handlers
 */
export function registerResearchEnhancedIpc() {
  registerHandler('research:queryEnhanced', z.object({
    query: z.string(),
    maxSources: z.number().optional(),
    includeCounterpoints: z.boolean().optional(),
    region: z.string().optional(),
    recencyWeight: z.number().optional(),
    authorityWeight: z.number().optional(),
  }), async (_event, request) => {
    const result = await researchQuery(request.query, {
      maxSources: request.maxSources,
      includeCounterpoints: request.includeCounterpoints,
      region: request.region,
      recencyWeight: request.recencyWeight,
      authorityWeight: request.authorityWeight,
    });
    return result;
  });
  
  // Clear cache
  registerHandler('research:clearCache', z.object({}), async () => {
    contentCache.clear();
    return { success: true };
  });
}

