/**
 * Document Review Service
 * Document ingestion, cross-check pipeline, claim verification
 */

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { registerHandler } from '../shared/ipc/router';
import { z } from 'zod';
import { researchQuery } from './research-enhanced';
import { exportDocument, exportToMarkdown, exportToHTML, CitationStyle } from './document-exports';
import { stealthFetchPage } from './stealth-fetch';

export interface DocumentSection {
  title: string;
  level: number;
  content: string;
  page?: number;
  line?: number;
  startPosition: number;
  endPosition: number;
}

export interface DocumentEntity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'concept' | 'other';
  occurrences: Array<{ position: number; context: string }>;
}

export interface TimelineEvent {
  date: string;
  description: string;
  source: string;
  confidence: number;
}

export interface DocumentClaim {
  id: string;
  text: string;
  position: number;
  page?: number;
  line?: number;
  section?: string;
  verification: {
    status: 'verified' | 'unverified' | 'disputed';
    sources: Array<{
      url: string;
      title: string;
      supports: boolean;
      confidence: number;
    }>;
    confidence: number;
  };
}

export interface FactHighlight {
  claimId: string;
  text: string;
  importance: 'verified' | 'disputed' | 'unverified';
  section?: string;
  position: number;
  fragment?: string;
}

export interface AssumptionHighlight {
  claimId: string;
  text: string;
  rationale: string;
  severity: 'low' | 'medium' | 'high';
  section?: string;
}

export interface AuditTrailEntry {
  claimId: string;
  section?: string;
  page?: number;
  line?: number;
  status: 'verified' | 'disputed' | 'unverified';
  link?: string;
}

export interface DocumentReview {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'web';
  content: string;
  sections: DocumentSection[];
  entities: DocumentEntity[];
  timeline: TimelineEvent[];
  claims: DocumentClaim[];
  factHighlights?: FactHighlight[];
  assumptions?: AssumptionHighlight[];
  auditTrail?: AuditTrailEntry[];
  entityGraph?: Array<{
    name: string;
    count: number;
    type: DocumentEntity['type'];
    connections: string[];
  }>;
  createdAt: number;
  updatedAt: number;
}

const documentStore = new Map<string, DocumentReview>();

/**
 * Extract sections/TOC from text
 */
function extractSections(text: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const lines = text.split('\n');
  
  let currentPosition = 0;
  let currentSection: DocumentSection | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      currentPosition += lines[i].length + 1;
      continue;
    }
    
    // Detect headings (simple heuristic)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/); // Markdown style
    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.endPosition = currentPosition;
        sections.push(currentSection);
      }
      
      // Start new section
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      currentSection = {
        title,
        level,
        content: '',
        line: i + 1,
        startPosition: currentPosition,
        endPosition: currentPosition,
      };
    } else if (currentSection) {
      // Add to current section
      currentSection.content += line + '\n';
    } else {
      // No section yet, create a default one
      if (sections.length === 0) {
        currentSection = {
          title: 'Introduction',
          level: 1,
          content: line + '\n',
          line: i + 1,
          startPosition: currentPosition,
          endPosition: currentPosition,
        };
      }
    }
    
    currentPosition += lines[i].length + 1;
  }
  
  // Save last section
  if (currentSection) {
    currentSection.endPosition = currentPosition;
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Extract entities from text (simplified NER)
 */
function extractEntities(text: string): DocumentEntity[] {
  const entityMap = new Map<string, DocumentEntity>();
  
  // Simple patterns for entity extraction
  // Dates
  const datePattern = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi;
  const dates = Array.from(text.matchAll(datePattern));
  dates.forEach(match => {
    const date = match[0];
    if (!entityMap.has(date)) {
      entityMap.set(date, {
        name: date,
        type: 'date',
        occurrences: [],
      });
    }
    const entity = entityMap.get(date)!;
    entity.occurrences.push({
      position: match.index || 0,
      context: text.slice(Math.max(0, match.index! - 50), match.index! + match[0].length + 50),
    });
  });
  
  // Capitalized words (potential proper nouns)
  const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  const capitalized = Array.from(text.matchAll(capitalizedPattern));
  const seen = new Set<string>();
  
  capitalized.forEach(match => {
    const name = match[0];
    // Skip common words
    if (name.length < 3 || ['The', 'This', 'That', 'These', 'Those', 'There', 'Here'].includes(name)) {
      return;
    }
    
    // Deduplicate
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    
    // Classify by context
    let type: DocumentEntity['type'] = 'other';
    const context = match.input?.slice(Math.max(0, match.index! - 20), match.index! + name.length + 20) || '';
    
    if (/\b(company|corporation|inc|llc|org|organization)\b/i.test(context)) {
      type = 'organization';
    } else if (/\b(person|people|individual|researcher|scientist|author)\b/i.test(context)) {
      type = 'person';
    } else if (/\b(location|city|country|state|region|place)\b/i.test(context)) {
      type = 'location';
    }
    
    if (!entityMap.has(name)) {
      entityMap.set(name, {
        name,
        type,
        occurrences: [],
      });
    }
    const entity = entityMap.get(name)!;
    entity.occurrences.push({
      position: match.index || 0,
      context: context,
    });
  });
  
  return Array.from(entityMap.values()).filter(e => e.occurrences.length > 0);
}

/**
 * Extract timeline events from text
 */
function extractTimeline(text: string, entities: DocumentEntity[]): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];
  const dateEntities = entities.filter(e => e.type === 'date');
  
  // Extract sentences containing dates
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    for (const dateEntity of dateEntities) {
      if (sentence.includes(dateEntity.name)) {
        timeline.push({
          date: dateEntity.name,
          description: sentence.trim().slice(0, 200),
          source: 'document',
          confidence: 0.8,
        });
        break; // One event per sentence
      }
    }
  }
  
  // Sort by date (simplified - would need proper date parsing)
  return timeline.slice(0, 20); // Limit to 20 events
}

/**
 * Extract claims from document
 */
function extractClaims(text: string, sections: DocumentSection[]): Array<{
  id: string;
  text: string;
  position: number;
  page?: number;
  line?: number;
  section?: string;
}> {
  const claims: Array<{
    id: string;
    text: string;
    position: number;
    page?: number;
    line?: number;
    section?: string;
  }> = [];
  
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 20);
  
  let position = 0;
  for (const sentence of sentences) {
    // Skip questions and exclamations
    if (sentence.trim().endsWith('?') || sentence.trim().endsWith('!')) {
      position += sentence.length + 1;
      continue;
    }
    
    // Check if sentence contains factual assertions
    const hasFactualWords = /\b(is|are|was|were|has|have|did|does|shows|indicates|suggests|demonstrates|proves|found|discovered|revealed)\b/i.test(sentence);
    const hasNumbers = /\d+/.test(sentence);
    
    if (hasFactualWords || hasNumbers) {
      // Find which section this claim belongs to
      const section = sections.find(s => 
        position >= s.startPosition && position < s.endPosition
      );
      
      claims.push({
        id: `claim_${claims.length + 1}`,
        text: sentence.trim(),
        position,
        section: section?.title,
        line: section?.line,
      });
    }
    
    position += sentence.length + 1;
  }
  
  return claims;
}

function createTextFragment(snippet: string): string {
  const sanitized = snippet.replace(/\s+/g, ' ').trim();
  if (!sanitized) return '';
  const start = sanitized.slice(0, 80);
  const end = sanitized.length > 120 ? sanitized.slice(-80) : '';
  const encode = (value: string) => encodeURIComponent(value.replace(/%/g, '').slice(0, 80));
  return end ? `#:~:text=${encode(start)},${encode(end)}` : `#:~:text=${encode(start)}`;
}

function buildFactHighlights(claims: DocumentClaim[]): FactHighlight[] | undefined {
  if (claims.length === 0) return undefined;
  return claims.slice(0, 20).map((claim) => ({
    claimId: claim.id,
    text: claim.text,
    importance: claim.verification.status as FactHighlight['importance'],
    section: claim.section,
    position: claim.position,
    fragment: createTextFragment(claim.text) || undefined,
  }));
}

function buildAssumptions(
  claims: DocumentClaim[]
): AssumptionHighlight[] | undefined {
  const assumptions = claims
    .filter(
      (claim) =>
        !claim.verification ||
        claim.verification.status !== 'verified' ||
        claim.verification.confidence < 0.6
    )
    .map((claim) => {
      const disputing = claim.verification?.sources
        ? claim.verification.sources.filter((s) => !s.supports).length
        : 0;
      const rationale =
        disputing > 0
          ? 'Conflicting external sources detected.'
          : 'Insufficient corroborating evidence detected.';
      const severity: 'low' | 'medium' | 'high' =
        disputing > 1 || claim.verification.confidence < 0.4
          ? 'high'
          : claim.verification.confidence < 0.55
            ? 'medium'
            : 'low';
      return {
        claimId: claim.id,
        text: claim.text,
        rationale,
        severity,
        section: claim.section,
      };
    });

  return assumptions.length > 0 ? assumptions : undefined;
}

function buildAuditTrail(claims: DocumentClaim[]): AuditTrailEntry[] | undefined {
  if (claims.length === 0) return undefined;
  return claims.map((claim) => ({
    claimId: claim.id,
    section: claim.section,
    page: claim.page,
    line: claim.line,
    status: claim.verification.status as AuditTrailEntry['status'],
    link: claim.verification.sources[0]?.url,
  }));
}

function buildEntityGraph(
  entities: DocumentEntity[],
  claims: DocumentClaim[]
): DocumentReview['entityGraph'] | undefined {
  if (entities.length === 0) return undefined;

  return entities.slice(0, 25).map((entity) => {
    const connections = claims
      .filter((claim) => claim.text.toLowerCase().includes(entity.name.toLowerCase()))
      .slice(0, 5)
      .map((claim) => claim.id);

    return {
      name: entity.name,
      count: entity.occurrences.length,
      type: entity.type,
      connections,
    };
  });
}

/**
 * Cross-check a claim against external sources
 */
async function crossCheckClaim(
  claim: string,
  maxSources = 5
): Promise<DocumentClaim['verification']> {
  try {
    // Use research query to find sources
    const researchResult = await researchQuery(claim, {
      maxSources,
      includeCounterpoints: true,
    });
    
    // Analyze sources to determine if they support or dispute the claim
    const supportingSources: DocumentClaim['verification']['sources'] = [];
    const disputingSources: DocumentClaim['verification']['sources'] = [];
    
    for (const source of researchResult.sources.slice(0, maxSources)) {
      const sourceText = source.text.toLowerCase();
      const claimLower = claim.toLowerCase();
      
      // Simple heuristic: check if key terms from claim appear in source
      const claimTerms = claimLower.split(/\s+/).filter(term => term.length > 3);
      const matchingTerms = claimTerms.filter(term => sourceText.includes(term)).length;
      const matchRatio = matchingTerms / claimTerms.length;
      
      const sourceEntry = {
        url: source.url,
        title: source.title,
        supports: matchRatio > 0.5,
        confidence: Math.min(1.0, matchRatio * source.relevanceScore / 10),
      };
      
      if (sourceEntry.supports) {
        supportingSources.push(sourceEntry);
      } else {
        disputingSources.push(sourceEntry);
      }
    }
    
    // Determine verification status
    let status: 'verified' | 'unverified' | 'disputed' = 'unverified';
    let confidence = 0;
    
    if (supportingSources.length > disputingSources.length && supportingSources.length >= 2) {
      status = 'verified';
      confidence = supportingSources.reduce((acc, s) => acc + s.confidence, 0) / supportingSources.length;
    } else if (disputingSources.length > supportingSources.length) {
      status = 'disputed';
      confidence = 1 - (disputingSources.reduce((acc, s) => acc + s.confidence, 0) / disputingSources.length);
    } else if (supportingSources.length > 0) {
      status = 'verified';
      confidence = supportingSources[0].confidence;
    }
    
    return {
      status,
      sources: [...supportingSources, ...disputingSources],
      confidence: Math.max(0.3, confidence), // Minimum 30% confidence
    };
  } catch (error) {
    console.error('Cross-check failed:', error);
    return {
      status: 'unverified',
      sources: [],
      confidence: 0,
    };
  }
}

/**
 * Ingest document from various sources
 */
export async function ingestDocument(
  source: string | Buffer,
  type: 'pdf' | 'docx' | 'web',
  title?: string
): Promise<DocumentReview> {
  let content = '';
  
  if (type === 'web') {
    // Fetch and extract from URL
    const stealthResult = await stealthFetchPage(source as string, { timeout: 15000 }).catch(() => null);
    if (stealthResult && stealthResult.html) {
      const dom = new JSDOM(stealthResult.html, { url: stealthResult.finalUrl || (source as string) });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      content = article?.textContent || dom.window.document.body?.textContent || '';
      title = title || article?.title || stealthResult.title || (source as string);
    } else {
      const res = await fetch(source as string, { headers: { 'User-Agent': 'OmniBrowserBot/1.0' } });
      const html = await res.text();
      const dom = new JSDOM(html, { url: source as string });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      content = article?.textContent || '';
      title = title || article?.title || source as string;
    }
  } else {
    // For PDF/DOCX, content should be pre-extracted
    content = source as string;
  }
  
  // Extract structure
  const sections = extractSections(content);
  const entities = extractEntities(content);
  const timeline = extractTimeline(content, entities);
  const claimTexts = extractClaims(content, sections);
  
  // Cross-check claims (in parallel, limited concurrency)
  const claims: DocumentClaim[] = [];
  const batchSize = 3; // Check 3 claims at a time
  
  for (let i = 0; i < claimTexts.length; i += batchSize) {
    const batch = claimTexts.slice(i, i + batchSize);
    const verificationResults = await Promise.all(
      batch.map(claim => crossCheckClaim(claim.text, 5))
    );
    
    for (let j = 0; j < batch.length; j++) {
      claims.push({
        ...batch[j],
        verification: verificationResults[j],
      });
    }
  }
  
  const review: DocumentReview = {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title: title || 'Untitled Document',
    type,
    content,
    sections,
    entities,
    timeline,
    claims,
    factHighlights: buildFactHighlights(claims),
    assumptions: buildAssumptions(claims),
    auditTrail: buildAuditTrail(claims),
    entityGraph: buildEntityGraph(entities, claims),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  documentStore.set(review.id, review);
  return review;
}

/**
 * Register IPC handlers
 */
export function registerDocumentReviewIpc() {
  registerHandler('document:ingest', z.object({
    source: z.string(), // URL or file path
    type: z.enum(['pdf', 'docx', 'web']),
    title: z.string().optional(),
  }), async (_event, request) => {
    const review = await ingestDocument(request.source, request.type, request.title);
    return review;
  });
  
  registerHandler('document:get', z.object({
    id: z.string(),
  }), async (_event, request) => {
    const review = documentStore.get(request.id);
    if (!review) {
      throw new Error('Document not found');
    }
    return review;
  });
  
  registerHandler('document:list', z.object({}), async () => {
    return Array.from(documentStore.values());
  });
  
  registerHandler('document:delete', z.object({
    id: z.string(),
  }), async (_event, request) => {
    const deleted = documentStore.delete(request.id);
    return { success: deleted };
  });
  
  registerHandler('document:reverify', z.object({
    id: z.string(),
  }), async (_event, request) => {
    const review = documentStore.get(request.id);
    if (!review) {
      throw new Error('Document not found');
    }
    
    // Re-verify all claims
    const claimTexts = review.claims.map(c => ({
      id: c.id,
      text: c.text,
      position: c.position,
      page: c.page,
      line: c.line,
      section: c.section,
    }));
    
    const batchSize = 3;
    const updatedClaims: DocumentClaim[] = [];
    
    for (let i = 0; i < claimTexts.length; i += batchSize) {
      const batch = claimTexts.slice(i, i + batchSize);
      const verificationResults = await Promise.all(
        batch.map(claim => crossCheckClaim(claim.text, 5))
      );
      
      for (let j = 0; j < batch.length; j++) {
        updatedClaims.push({
          ...batch[j],
          verification: verificationResults[j],
        });
      }
    }
    
    review.claims = updatedClaims;
    review.updatedAt = Date.now();
    
    return review;
  });
  
  registerHandler('document:export', z.object({
    id: z.string(),
    format: z.enum(['markdown', 'html']),
    outputPath: z.string(),
    citationStyle: z.enum(['apa', 'mla', 'chicago', 'ieee', 'harvard']).optional(),
  }), async (_event, request) => {
    const review = documentStore.get(request.id);
    if (!review) {
      throw new Error('Document not found');
    }
    
    await exportDocument(
      review,
      request.format,
      request.outputPath,
      (request.citationStyle as CitationStyle) || 'apa'
    );
    
    return { success: true, path: request.outputPath };
  });
  
  registerHandler('document:exportToString', z.object({
    id: z.string(),
    format: z.enum(['markdown', 'html']),
    citationStyle: z.enum(['apa', 'mla', 'chicago', 'ieee', 'harvard']).optional(),
  }), async (_event, request) => {
    const review = documentStore.get(request.id);
    if (!review) {
      throw new Error('Document not found');
    }
    
    const style = (request.citationStyle as CitationStyle) || 'apa';
    const content = request.format === 'markdown'
      ? exportToMarkdown(review, style)
      : exportToHTML(review, style);
    
    return { content };
  });
}

