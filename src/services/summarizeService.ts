/**
 * Summarize Service - Tier 1
 * Unified service for summarizing URLs and text with proper error handling
 */

import { summarizeApi } from '../lib/api-client';
import { toast } from '../utils/toast';
import { log } from '../utils/logger';
import { track } from './analytics';
import { validateUrlForAgent } from '../core/security/urlSafety';

export interface SummarizeOptions {
  url?: string;
  text?: string;
  question?: string;
  maxWaitSeconds?: number;
}

export interface SummarizeResult {
  summary: string;
  answer?: string;
  highlights?: string[];
  model: string;
  jobId: string;
  sources: Array<{ url: string; jobId: string; selector: string | null }>;
  provenance: any;
}

export type SummarizeState =
  | { status: 'idle' }
  | { status: 'loading'; progress?: string }
  | { status: 'success'; result: SummarizeResult }
  | { status: 'error'; error: string; code?: string };

/**
 * Summarize URL or text using the unified API
 * Handles all polling internally - frontend just waits for result
 */
export async function summarize(options: SummarizeOptions): Promise<SummarizeResult> {
  const { url, text, question, maxWaitSeconds = 30 } = options;

  if (!url && !text) {
    throw new Error('Either url or text must be provided');
  }

  // Tier 1: Security guardrails - validate URL before processing
  if (url) {
    const validation = validateUrlForAgent(url);
    if (!validation.safe) {
      const error = new Error(validation.reason || 'URL is not safe for scraping');
      log.warn('Summarize blocked by security check', { url, reason: validation.reason });
      track('error_shown', {
        context: 'summarize_security',
        error: validation.reason || 'Unsafe URL',
      });
      throw error;
    }
  }

  try {
    log.info('Summarize request', { url, hasText: !!text, question });

    // Tier 1: Track summarize request
    track('summary_requested', {
      hasUrl: !!url,
      hasText: !!text,
      hasQuestion: !!question,
    });

    const result = await summarizeApi.summarize({
      url,
      text,
      question,
      maxWaitSeconds,
    });

    log.info('Summarize success', { jobId: result.jobId, model: result.model });
    return result;
  } catch (error: any) {
    log.error('Summarize failed', error);

    // Tier 1: Track error
    track('error_shown', {
      context: 'summarize',
      error: error.message || 'Unknown error',
    });

    // Handle specific error codes
    if (error.message?.includes('scrape-timeout')) {
      throw new Error('The page took too long to load. Please try again or check the URL.');
    }

    if (error.message?.includes('scrape-failed') || error.message?.includes('502')) {
      throw new Error(
        'Failed to load the page. The URL may be invalid or the site may be blocking requests.'
      );
    }

    if (error.message?.includes('llm-circuit-open') || error.message?.includes('503')) {
      throw new Error('AI service is temporarily unavailable. Please try again in a moment.');
    }

    if (error.message?.includes('Backend offline')) {
      throw new Error('Backend service is offline. Please check your connection.');
    }

    // Generic error
    throw new Error(error.message || 'Failed to generate summary. Please try again.');
  }
}

/**
 * Summarize with toast notifications for user feedback
 */
export async function summarizeWithFeedback(
  options: SummarizeOptions
): Promise<SummarizeResult | null> {
  const loadingToast = toast.loading(
    options.url ? `Summarizing ${new URL(options.url).hostname}...` : 'Generating summary...'
  );

  try {
    const result = await summarize(options);
    toast.dismiss(loadingToast);
    toast.success('Summary generated successfully');
    return result;
  } catch (error: any) {
    toast.dismiss(loadingToast);
    toast.error(error.message || 'Failed to generate summary');
    return null;
  }
}
