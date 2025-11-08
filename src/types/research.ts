export type ResearchSourceType = 'news' | 'academic' | 'documentation' | 'forum' | 'other';

export interface ResearchSource {
  url: string;
  title: string;
  text: string;
  snippet: string;
  timestamp?: number;
  domain: string;
  relevanceScore: number;
  sourceType: ResearchSourceType;
  metadata?: Record<string, unknown>;
}

export interface ResearchCitation {
  index: number;
  sourceIndex: number;
  quote: string;
  confidence: number;
}

export interface ResearchContradiction {
  claim: string;
  sources: number[];
  disagreement: 'minor' | 'major';
}

export interface VerificationResult {
  verified: boolean;
  claimDensity: number;
  citationCoverage: number;
  ungroundedClaims: Array<{
    text: string;
    position: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  hallucinationRisk: number;
  suggestions: string[];
}

export interface ResearchResult {
  query: string;
  sources: ResearchSource[];
  summary: string;
  citations: ResearchCitation[];
  confidence: number;
  contradictions?: ResearchContradiction[];
  verification?: VerificationResult;
}

