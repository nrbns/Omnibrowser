/**
 * SearchBar - Lightweight search component with DuckDuckGo Instant + Lunr local fallback
 * This is a minimal, working search that returns results immediately
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Globe, FileText, Sparkles, Brain, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { fetchDuckDuckGoInstant, formatDuckDuckGoResults } from '../services/duckDuckGoSearch';
import { searchLocal } from '../utils/lunrIndex';
import { ipc } from '../lib/ipc-typed';
import { trackSearch, trackAction } from '../core/supermemory/tracker';
import { useSuggestions } from '../core/supermemory/useSuggestions';
import { searchVectors } from '../core/supermemory/vectorStore';
import { semanticSearchMemories } from '../core/supermemory/search';
import { useTabsStore } from '../state/tabsStore';
// import { EcoBadge } from './EcoBadge'; // Unused for now
import { QueryResult, detectIntent } from '../core/query-engine';
import { AnswerCard } from './AnswerCard';
import { useAppStore } from '../state/appStore';
import type { AppState } from '../state/appStore';
import { type SearchLLMResponse } from '../services/searchLLM';
import { MemoryStoreInstance } from '../core/supermemory/store';
import { showToast } from '../state/toastStore';
import { aiEngine, type AITaskResult } from '../core/ai';
import { useHistoryStore, type HistoryEntry } from '../state/historyStore';

// Search proxy base URL (defaults to localhost:3001)
const SEARCH_PROXY_URL = import.meta.env.VITE_SEARCH_PROXY_URL || 'http://localhost:3001';

type SearchResult = {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  type: 'duck' | 'local' | 'memory' | 'proxy';
  source?: 'instant' | 'result' | 'related' | 'duckduckgo' | 'bing' | 'brave' | 'fused';
  similarity?: number; // For vector search results
};

function mapLlmResponseToQueryResult(response: SearchLLMResponse, query: string): QueryResult {
  const sources = (response.raw_results || []).map((result) => ({
    url: result.url,
    title: result.title || result.url || 'Source',
    snippet: result.snippet || '',
  }));

  const citations = (response.citations || []).map((citation, index) => ({
    index: index + 1,
    url: citation.url,
    title: citation.title || citation.url || `Source ${index + 1}`,
  }));

  return {
    answer: response.answer,
    intent: detectIntent(query),
    sources,
    citations,
    latency: response.latency_ms ?? 0,
  };
}

type SearchProvider = 'google' | 'duckduckgo';

const SEARCH_PROVIDER_URL: Record<SearchProvider, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
};

type SmartCommand = {
  id: string;
  trigger: string;
  label: string;
  description: string;
  sample?: string;
  targetMode?: AppState['mode'];
  provider?: SearchProvider;
};

const SMART_COMMANDS: SmartCommand[] = [
  {
    id: 'google',
    trigger: '/g',
    label: 'Google search',
    description: 'Search Google from any mode',
    sample: '/g regen browser',
    provider: 'google',
    targetMode: 'Browse',
  },
  {
    id: 'duck',
    trigger: '/d',
    label: 'DuckDuckGo search',
    description: 'Private search via DuckDuckGo',
    sample: '/d privacy-first browsers',
    provider: 'duckduckgo',
  },
  {
    id: 'research',
    trigger: '/r',
    label: 'Research mode',
    description: 'Switch to research mode + ask AI',
    sample: '/r clean energy market outlook',
    targetMode: 'Research',
    provider: 'duckduckgo',
  },
  {
    id: 'trade',
    trigger: '/t',
    label: 'Trade mode',
    description: 'Jump into Trade mode with a ticker',
    sample: '/t NVDA earnings',
    targetMode: 'Trade',
    provider: 'duckduckgo',
  },
];

type SuggestionItem = {
  id: string;
  value: string;
  label: string;
  description?: string;
  badge?: string;
  url?: string;
  kind: 'history' | 'tab' | 'memory' | 'command';
  onSelect: () => void;
};

type SuggestionGroup = {
  key: string;
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  accentClass: string;
  items: SuggestionItem[];
};

type ParsedInput =
  | { kind: 'url'; url: string }
  | { kind: 'search'; query: string; provider: SearchProvider; targetMode?: AppState['mode'] };

const ensureHttpUrl = (value: string) => {
  if (!value) return 'about:blank';
  if (/^[a-z]+:\/\//i.test(value) || value.startsWith('about:') || value.startsWith('chrome://')) {
    return value;
  }
  return `https://${value}`;
};

const looksLikeUrl = (value: string) => {
  if (!value) return false;
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('about:') || value.startsWith('chrome://')) {
    return true;
  }
  const domainPattern = /^[a-z0-9]+([-.][a-z0-9]+)+([/?].*)?$/i;
  return domainPattern.test(value.trim());
};

const parseCommandInput = (value: string): { match: boolean; provider?: SearchProvider; query: string; targetMode?: AppState['mode'] } => {
  if (!value.startsWith('/')) return { match: false, query: value };
  const [command, ...restParts] = value.slice(1).split(' ');
  const remainder = restParts.join(' ').trim();
  if (!remainder) {
    return { match: false, query: value };
  }
  switch (command.toLowerCase()) {
    case 'g':
    case 'google':
      return { match: true, provider: 'google', query: remainder };
    case 'ddg':
    case 'duck':
    case 'd':
      return { match: true, provider: 'duckduckgo', query: remainder };
    case 'r':
    case 'research':
      return { match: true, provider: 'duckduckgo', query: remainder, targetMode: 'Research' };
    case 'b':
    case 'browse':
      return { match: true, provider: 'duckduckgo', query: remainder, targetMode: 'Browse' };
    default:
      return { match: false, query: value };
  }
};

const interpretInput = (value: string): ParsedInput => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { kind: 'search', provider: 'duckduckgo', query: '' };
  }

  if (looksLikeUrl(trimmed)) {
    return { kind: 'url', url: ensureHttpUrl(trimmed) };
  }

  const command = parseCommandInput(trimmed);
  if (command.match) {
    return {
      kind: 'search',
      query: command.query,
      provider: command.provider ?? 'duckduckgo',
      targetMode: command.targetMode,
    };
  }

  return { kind: 'search', provider: 'duckduckgo', query: trimmed };
};

export default function SearchBar() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [duckResults, setDuckResults] = useState<SearchResult[]>([]);
  const [localResults, setLocalResults] = useState<SearchResult[]>([]);
  const [memoryResults, setMemoryResults] = useState<SearchResult[]>([]);
  const [proxyResults, setProxyResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiResponse, setShowAiResponse] = useState(false);
  const [askingAboutPage, setAskingAboutPage] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [llmResult, setLlmResult] = useState<SearchLLMResponse | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showSearchResults, setShowSearchResults] = useState(false); // Collapsed by default
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  
  // Get active tab for "Ask about this page"
  const activeTab = useTabsStore((state) => {
    if (!state.activeId) return null;
    return state.tabs.find((t) => t.id === state.activeId) || null;
  });
  const allTabs = useTabsStore((state) => state.tabs);
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  
  // SuperMemory + history suggestions
  const historyEntries = useHistoryStore((state) => state.entries);
  const addHistoryEntry = useHistoryStore((state) => state.addEntry);
  const suggestions = useSuggestions(q, { types: ['search', 'visit', 'bookmark'], limit: 5 });
  const historyMatches = useMemo(() => {
    if (!historyEntries.length) {
      return [];
    }
    const term = q.trim().toLowerCase();
    const base = historyEntries;
    if (!term) {
      return base.slice(0, 6);
    }
    return base
      .filter((entry) => {
        const hay = `${entry.value ?? ''} ${entry.url ?? ''}`.toLowerCase();
        return hay.includes(term);
      })
      .slice(0, 6);
  }, [historyEntries, q]);
  const tabMatches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const seen = new Set<string>();
    return allTabs
      .filter((tab) => (tab.title || tab.url) && tab.id)
      .filter((tab) => {
        const hay = `${tab.title ?? ''} ${tab.url ?? ''}`.toLowerCase();
        return hay.includes(term);
      })
      .filter((tab) => {
        if (seen.has(tab.id)) return false;
        seen.add(tab.id);
        return true;
      })
      .slice(0, 6);
  }, [allTabs, q]);
  const commandMatches = useMemo(() => {
    if (!q.startsWith('/')) {
      return [];
    }
    const term = q.toLowerCase();
    return SMART_COMMANDS.filter((command) => command.trigger.startsWith(term) || term.startsWith(command.trigger)).slice(0, 4);
  }, [q]);

  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setDuckResults([]);
      setLocalResults([]);
      setProxyResults([]);
      setError(null);
      return;
    }

    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      const startTime = Date.now();
      
      try {
        // Fetch all sources in parallel
        const [duckData, localData, vectorResults, proxyData] = await Promise.all([
          fetchDuckDuckGoInstant(q).catch(() => null),
          searchLocal(q).catch(() => []),
          searchVectors(q, { maxVectors: 5, minSimilarity: 0.6 }).catch(() => []),
          // Try to fetch from search-proxy, but fallback to DuckDuckGo if unavailable
          fetch(`${SEARCH_PROXY_URL}/api/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, sources: ['duckduckgo'], limit: 10 }),
          }).then(res => res.ok ? res.json() : null).catch(() => null),
        ]);
        
        if (cancelled) return;
        
        const latency = Date.now() - startTime;
        
        // Track metrics
        if (latency > 0) {
          console.debug(`[SearchBar] Search completed in ${latency}ms`);
        }
        
        // Format search-proxy results (preferred if available)
        if (proxyData && Array.isArray(proxyData.results)) {
          const formatted = proxyData.results.map((r: any, idx: number) => ({
            id: `proxy-${idx}`,
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            type: 'proxy' as const,
            source: r.source,
          }));
          setProxyResults(formatted);
          setDuckResults([]); // Don't show duplicate DuckDuckGo results
        } else {
          setProxyResults([]);
          // Format DuckDuckGo results (fallback)
          if (duckData) {
            const formatted = formatDuckDuckGoResults(duckData).map((r, idx) => ({
              id: `duck-${idx}`,
              title: r.title,
              url: r.url,
              snippet: r.snippet,
              type: 'duck' as const,
              source: r.type,
            }));
            setDuckResults(formatted);
          } else {
            setDuckResults([]);
          }
        }
        
        // Format local results
        const local = localData.map((r, idx) => ({
          id: `local-${r.id || idx}`,
          title: r.title,
          snippet: r.snippet,
          type: 'local' as const,
        }));
        setLocalResults(local);
        
        // Format memory/vector search results
        const memory = vectorResults
          .filter((r) => r.similarity >= 0.6)
          .map((r, idx) => ({
            id: `memory-${r.embedding.id || idx}`,
            title: r.embedding.metadata?.title || r.embedding.text.substring(0, 50) || 'Memory',
            url: r.embedding.metadata?.url,
            snippet: r.embedding.text.substring(0, 150),
            type: 'memory' as const,
            similarity: r.similarity,
          }));
        setMemoryResults(memory);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const t = setTimeout(run, 150); // debounce
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const handleResultClick = async (result: SearchResult) => {
    if (result.url) {
      // Track search result click
      trackSearch(result.url, { 
        url: result.url, 
        title: result.title,
        clickedResult: {
          url: result.url,
          title: result.title,
          position: 0, // Would need to track position from results array
        },
      }).catch(console.error);
      
      try {
        await ipc.tabs.create(result.url);
        addHistoryEntry({
          type: 'url',
          value: result.title || result.url || 'Result',
          url: result.url,
          appMode: mode,
        });
      } catch (error) {
        console.error('[SearchBar] Failed to open URL:', error);
        // Fallback: open in external browser
        if (typeof window !== 'undefined') {
          window.open(result.url, '_blank', 'noopener,noreferrer');
        }
      }
    }
  };

  const handleSuggestionClick = async (suggestion: { value: string; type: string; metadata?: any }) => {
    // Track suggestion click
    trackSearch(suggestion.value, { url: suggestion.metadata?.url, title: suggestion.metadata?.title }).catch(console.error);
    
    setQ(suggestion.value);
    setActiveSuggestionIndex(-1);
    
    // If it's a URL, open it
    if (suggestion.metadata?.url) {
      try {
        await ipc.tabs.create(suggestion.metadata.url);
      } catch (error) {
        console.error('[SearchBar] Failed to open suggestion URL:', error);
      }
    }
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    if (entry.type === 'url' && entry.url) {
      setQ(entry.url);
      void handleSubmit(undefined, entry.url);
      setActiveSuggestionIndex(-1);
      return;
    }
    setQ(entry.value);
    void handleSubmit(undefined, entry.value);
    setActiveSuggestionIndex(-1);
  };

  const handleOpenTabSelect = async (tabId: string) => {
    try {
      useTabsStore.getState().setActive(tabId);
      await ipc.tabs.activate({ id: tabId });
    } catch (error) {
      console.error('[SearchBar] Failed to activate tab:', error);
    } finally {
      setActiveSuggestionIndex(-1);
    }
  };

  const handleCommandSelect = (command: SmartCommand) => {
    const trigger = command.trigger.endsWith(' ') ? command.trigger : `${command.trigger} `;
    if (!q.startsWith(trigger)) {
      setQ(trigger);
    }
    setActiveSuggestionIndex(-1);
  };

  const handleSubmit = async (e?: React.FormEvent, overrideValue?: string) => {
    if (e) {
      e.preventDefault();
    }
    let inputValue = (overrideValue ?? q).trim();
    if (!inputValue) {
      return;
    }

    const parsed = interpretInput(inputValue);

    if (parsed.kind === 'url') {
      const finalUrl = ensureHttpUrl(parsed.url);
      try {
        await ipc.tabs.create(finalUrl);
        showToast('success', 'Opening link...');
        setQ('');
        addHistoryEntry({
          type: 'url',
          value: finalUrl,
          url: finalUrl,
          appMode: mode,
        });
        return;
      } catch (error) {
        console.error('[SearchBar] Failed to open URL:', error);
        showToast('error', 'Unable to open that link.');
        return;
      }
    }

    let activeModeForSearch = mode;
    if (parsed.targetMode && parsed.targetMode !== mode) {
      try {
        await setMode(parsed.targetMode);
        activeModeForSearch = parsed.targetMode;
      } catch (error) {
        console.warn('[SearchBar] Failed to switch mode for search:', error);
      }
    }

    const query = parsed.query;
    setQ(query);
    
    // Track search and remember in history
    trackSearch(query).catch(console.error);
    addHistoryEntry({
      type: 'search',
      value: query,
      appMode: activeModeForSearch,
    });
    
    setAiLoading(true);
    setShowAiResponse(true);
    setQueryResult(null);
    setLlmResult(null);
    setAiResponse('');
    setSaveStatus('idle');
    setError(null);
    setShowSearchResults(false);

    // Build enhanced context with tab info and relevant memories
    const tabContext = activeTab
      ? {
          active_tab: {
            url: activeTab.url,
            title: activeTab.title,
          },
          mode: activeModeForSearch,
        }
      : { mode: activeModeForSearch };

    // Fetch relevant memories for context
    let relevantMemories: any[] = [];
    try {
      const memoryMatches = await semanticSearchMemories(query, { limit: 5, minSimilarity: 0.6 });
      relevantMemories = memoryMatches.map((m) => ({
        value: m.event.value,
        metadata: m.event.metadata,
        id: m.event.id,
        type: m.event.type,
        similarity: m.similarity,
      }));
    } catch (error) {
      console.warn('[SearchBar] Failed to fetch memory context:', error);
    }

    const enhancedContext = relevantMemories.length > 0 
      ? { ...tabContext, memories: relevantMemories }
      : tabContext;

    try {
      let streamedText = '';
      let streamedResult: AITaskResult | null = null;
      const result = await aiEngine.runTask(
        {
          kind: 'search',
          prompt: query,
          context: enhancedContext,
          metadata: { mode: activeModeForSearch },
          llm: {
            temperature: 0.2,
            maxTokens: 800,
          },
        },
        (event) => {
          if (event.type === 'token' && typeof event.data === 'string') {
            streamedText += event.data;
            setAiResponse((prev) => `${prev}${event.data}`);
          } else if (event.type === 'error') {
            setError(typeof event.data === 'string' ? event.data : 'AI search stream failed.');
          } else if (event.type === 'done' && event.data && typeof event.data !== 'string') {
            streamedResult = event.data as AITaskResult;
          }
        },
      );

      const finalResult = streamedResult ?? result;
      const finalAnswer = streamedText || finalResult.text;
      setAiLoading(false);
      setAiResponse(finalAnswer);

      const citations =
        finalResult.citations && finalResult.citations.length > 0
          ? finalResult.citations.map((citation, idx) => ({
              title: citation.title || citation.url || `Source ${idx + 1}`,
              url: citation.url || '',
              snippet: citation.snippet,
              source: citation.source,
            }))
          : [];

      const syntheticResponse: SearchLLMResponse = {
        query,
        answer: finalAnswer,
        citations,
        raw_results: citations,
        timestamp: Date.now() / 1000,
        latency_ms: finalResult.latency ?? 0,
      };

      setLlmResult(syntheticResponse);
      setQueryResult(mapLlmResponseToQueryResult(syntheticResponse, query));
      showToast('success', 'AI answer ready.');
      trackAction('ai_task_success', {
        source: 'SearchBar',
        kind: 'search',
        mode: activeModeForSearch,
        queryLength: query.length,
        provider: finalResult.provider,
        model: finalResult.model,
        latencyMs: finalResult.latency ?? null,
        promptTokens: finalResult.usage?.promptTokens ?? null,
        completionTokens: finalResult.usage?.completionTokens ?? null,
        totalTokens: finalResult.usage?.totalTokens ?? null,
        citationCount: citations.length,
        hadContext: Boolean(enhancedContext?.active_tab?.url),
      }).catch(() => {});
      return;
    } catch (err) {
      console.warn('[SearchBar] aiEngine.runTask failed, falling back:', err);
      trackAction('ai_task_error', {
        source: 'SearchBar',
        kind: 'search',
        mode: activeModeForSearch,
        queryLength: query.length,
        error: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }

    // Final fallback: open a traditional search tab.
    try {
      const fallbackUrl = `${SEARCH_PROVIDER_URL.duckduckgo}${encodeURIComponent(query)}`;
      await ipc.tabs.create(fallbackUrl);
    } catch (error) {
      console.error('[SearchBar] Failed to open fallback search URL:', error);
    }
    setAiLoading(false);
    setError('AI search unavailable. Opened DuckDuckGo instead.');
    showToast('error', 'AI search unavailable. Opening DuckDuckGo.');
  };

  const allResults = [...memoryResults, ...proxyResults, ...duckResults, ...localResults];
  const hasResults = allResults.length > 0;

  // Handle "Ask about this page"
  const handleAskAboutPage = async () => {
    if (!activeTab?.url || !activeTab.title) {
      setError('No active page to ask about');
      return;
    }

    setAskingAboutPage(true);
    setShowAiResponse(true);
    setAiResponse('');
    setError(null);

    try {
      // Use LLM adapter to ask about the page
      const prompt = `Based on the page "${activeTab.title}" (${activeTab.url}), answer the user's question: ${q || 'What is this page about?'}`;
      
      const response = await aiEngine.runTask({
        kind: 'agent',
        prompt,
        context: { tabUrl: activeTab.url, tabTitle: activeTab.title },
        llm: { maxTokens: 500 },
      }, (event) => {
        if (event.type === 'token' && typeof event.data === 'string') {
          setAiResponse((prev) => `${prev}${event.data}`);
        }
      });

      setAiResponse(response.text);
      trackAction('ai_task_success', {
        source: 'SearchBar',
        kind: 'agent',
        mode: mode,
        queryLength: prompt.length,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latency ?? null,
        promptTokens: response.usage?.promptTokens ?? null,
        completionTokens: response.usage?.completionTokens ?? null,
        totalTokens: response.usage?.totalTokens ?? null,
        hadContext: true,
      }).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to get AI response about page');
      trackAction('ai_task_error', {
        source: 'SearchBar',
        kind: 'agent',
        mode: mode,
        queryLength: (q || '').length,
        error: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    } finally {
      setAskingAboutPage(false);
    }
  };

  const handleSaveAnswerToMemory = async () => {
    if (!llmResult) {
      return;
    }
    setSaveStatus('saving');
    try {
      await MemoryStoreInstance.saveEvent({
        type: 'note',
        value: llmResult.answer,
        metadata: {
          url: llmResult.citations?.[0]?.url || activeTab?.url || '',
          title: llmResult.query,
          notePreview: llmResult.answer.substring(0, 200),
          tags: ['ai-answer', 'search'],
        },
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 4000);
      trackAction('memory_save', {
        source: 'search_llm',
        query: llmResult.query,
        title: llmResult.query,
      }).catch(() => {});
      showToast('success', 'Saved to SuperMemory.');
    } catch (err) {
      console.error('[SearchBar] Failed to save AI answer to memory:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
      trackAction('memory_save_error', {
        source: 'search_llm',
        query: llmResult.query,
        error: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
      showToast('error', 'Failed to save to SuperMemory.');
    }
  };

  const suggestionGroups = useMemo<SuggestionGroup[]>(() => {
    const groups: SuggestionGroup[] = [];
    if (historyMatches.length > 0) {
      groups.push({
        key: 'history',
        title: 'Recent search & visits',
        icon: Clock,
        accentClass: 'text-amber-400',
        items: historyMatches.map((entry) => ({
          id: entry.id,
          value: entry.value,
          label: entry.value,
          description: entry.url,
          badge: entry.appMode,
          url: entry.url,
          kind: 'history',
          onSelect: () => handleHistorySelect(entry),
        })),
      });
    }
    if (tabMatches.length > 0) {
      groups.push({
        key: 'tabs',
        title: 'Open tabs',
        icon: Globe,
        accentClass: 'text-sky-400',
        items: tabMatches.map((tab) => ({
          id: `tab-${tab.id}`,
          value: tab.url || tab.title || '',
          label: tab.title || tab.url || 'Tab',
          description: tab.url || undefined,
          badge: tab.appMode,
          url: tab.url,
          kind: 'tab',
          onSelect: () => handleOpenTabSelect(tab.id),
        })),
      });
    }
    if (commandMatches.length > 0) {
      groups.push({
        key: 'commands',
        title: 'Commands',
        icon: FileText,
        accentClass: 'text-purple-300',
        items: commandMatches.map((command) => ({
          id: `command-${command.id}`,
          value: command.trigger,
          label: `${command.trigger} — ${command.label}`,
          description: command.description,
          badge: command.sample,
          kind: 'command',
          onSelect: () => handleCommandSelect(command),
        })),
      });
    }
    if (suggestions.length > 0) {
      groups.push({
        key: 'memory',
        title: 'Suggested for you',
        icon: Sparkles,
        accentClass: 'text-purple-400',
        items: suggestions.map((suggestion, idx) => ({
          id: `memory-${idx}-${suggestion.value}`,
          value: suggestion.value,
          label: suggestion.value,
          description: suggestion.metadata?.title,
          badge: suggestion.count > 1 ? `Used ${suggestion.count}×` : 'Recently used',
          kind: 'memory',
          onSelect: () => handleSuggestionClick(suggestion),
        })),
      });
    }
    return groups;
  }, [commandMatches, handleCommandSelect, handleHistorySelect, handleOpenTabSelect, handleSuggestionClick, historyMatches, suggestions, tabMatches]);

  const flatSuggestions = useMemo(() => suggestionGroups.flatMap((group) => group.items), [suggestionGroups]);
  const inlineCandidate = useMemo(() => {
    const term = q;
    if (!term) return null;
    const lower = term.toLowerCase();
    return flatSuggestions.find(
      (item) => item.value && item.value.toLowerCase().startsWith(lower) && item.value.toLowerCase() !== lower,
    );
  }, [flatSuggestions, q]);
  const inlineCompletion =
    inlineCandidate && inlineCandidate.value.length > q.length
      ? inlineCandidate.value.slice(q.length)
      : '';
  const showAssistPanel = q.trim().length > 0 && suggestionGroups.some((group) => group.items.length > 0);

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [q]);

  useEffect(() => {
    if (activeSuggestionIndex >= flatSuggestions.length) {
      setActiveSuggestionIndex(flatSuggestions.length ? flatSuggestions.length - 1 : -1);
    }
  }, [activeSuggestionIndex, flatSuggestions.length]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab' && inlineCandidate) {
      event.preventDefault();
      setQ(inlineCandidate.value);
      setActiveSuggestionIndex(-1);
      return;
    }
    if (flatSuggestions.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => {
        const next = prev + 1;
        if (next >= flatSuggestions.length) {
          return 0;
        }
        return next;
      });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => {
        if (prev <= 0) {
          return flatSuggestions.length - 1;
        }
        return prev - 1;
      });
      return;
    }
    if (event.key === 'Enter' && activeSuggestionIndex >= 0 && flatSuggestions[activeSuggestionIndex]) {
      event.preventDefault();
      flatSuggestions[activeSuggestionIndex].onSelect();
      setActiveSuggestionIndex(-1);
      return;
    }
    if (event.key === 'Escape' && activeSuggestionIndex !== -1) {
      event.preventDefault();
      setActiveSuggestionIndex(-1);
    }
  };

  let suggestionRowCursor = -1;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-3 rounded-xl border border-gray-700/50 bg-gray-900/60 px-4 py-3 shadow-inner focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
          <Search size={18} className="text-gray-500 flex-shrink-0" />
          <div className="relative flex-1">
            {inlineCompletion && (
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-base text-white/30 select-none">
                <span className="opacity-0">{q}</span>
                <span>{inlineCompletion}</span>
              </span>
            )}
            <input
              type="text"
              placeholder="Search the web or docs..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="relative z-10 w-full bg-transparent text-base text-white placeholder:text-gray-500 focus:outline-none"
              autoFocus
            />
          </div>
          {loading && (
            <Loader2 size={16} className="text-gray-400 animate-spin flex-shrink-0" />
          )}
          {activeTab?.url && activeTab.url.startsWith('http') && (
            <button
              type="button"
              onClick={handleAskAboutPage}
              disabled={askingAboutPage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ask AI about this page"
            >
              <Brain size={14} className={askingAboutPage ? 'animate-pulse' : ''} />
              <span>Ask about page</span>
            </button>
          )}
        </div>

        {/* Unified suggestions */}
        {showAssistPanel && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-slate-800/80 bg-slate-950/95 backdrop-blur-xl shadow-2xl z-50">
            {suggestionGroups.map((group, groupIdx) => {
              if (group.items.length === 0) return null;
              const borderClass = groupIdx !== suggestionGroups.length - 1 ? 'border-b border-slate-800/70' : '';
              return (
                <div key={`${group.key}-${groupIdx}`} className={`px-4 py-3 ${borderClass}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <group.icon width={14} height={14} className={group.accentClass} />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</h3>
                  </div>
                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      suggestionRowCursor += 1;
                      const isActive = suggestionRowCursor === activeSuggestionIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => item.onSelect()}
                          onMouseEnter={() => setActiveSuggestionIndex(suggestionRowCursor)}
                          className={`w-full rounded-xl px-3 py-2 text-left transition-colors focus:outline-none ${
                            isActive
                              ? 'bg-slate-800/70 border border-slate-700 text-white'
                              : 'border border-transparent hover:bg-slate-800/40 text-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-100 line-clamp-1">{item.label}</div>
                              {item.description && (
                                <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.description}</div>
                              )}
                              {item.url && (
                                <div className="text-xs text-slate-500 mt-0.5 truncate">{item.url}</div>
                              )}
                            </div>
                            {item.badge && (
                              <span className="text-[11px] uppercase tracking-wide text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Results Dropdown */}
        {hasResults && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-gray-700/50 bg-gray-900/95 backdrop-blur-xl shadow-2xl max-h-[500px] overflow-y-auto z-50">
            {memoryResults.length > 0 && (
              <div className="p-3 border-b border-gray-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={14} className="text-purple-400" />
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Memory Results</h3>
                </div>
                <div className="space-y-1">
                  {memoryResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-purple-200 line-clamp-1">{result.title}</div>
                        {result.similarity !== undefined && (
                          <span className="text-xs text-purple-400/70 ml-2">
                            {Math.round(result.similarity * 100)}%
                          </span>
                        )}
                      </div>
                      {result.snippet && (
                        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{result.snippet}</div>
                      )}
                      {result.url && (
                        <div className="text-xs text-gray-500 mt-1 truncate">{result.url}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {proxyResults.length > 0 && (
              <div className="p-3 border-b border-gray-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={14} className="text-blue-400" />
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Search Results</h3>
                </div>
                <div className="space-y-1">
                  {proxyResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <div className="text-sm font-medium text-white line-clamp-1">{result.title}</div>
                      {result.snippet && (
                        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{result.snippet}</div>
                      )}
                      {result.url && (
                        <div className="text-xs text-gray-500 mt-1 truncate">{result.url}</div>
                      )}
                      {result.source && (
                        <div className="text-xs text-gray-600 mt-1 capitalize">{result.source}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {duckResults.length > 0 && (
              <div className="p-3 border-b border-gray-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={14} className="text-blue-400" />
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Web Results</h3>
                </div>
                <div className="space-y-1">
                  {duckResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <div className="text-sm font-medium text-white line-clamp-1">{result.title}</div>
                      {result.snippet && (
                        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{result.snippet}</div>
                      )}
                      {result.url && (
                        <div className="text-xs text-gray-500 mt-1 truncate">{result.url}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {localResults.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-green-400" />
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Local Docs</h3>
                </div>
                <div className="space-y-1">
                  {localResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <div className="text-sm font-medium text-white line-clamp-1">{result.title}</div>
                      {result.snippet && (
                        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{result.snippet}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="absolute top-full left-0 right-0 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/40 text-sm text-red-200">
            {error}
          </div>
        )}
      </form>

      {/* PHASE 1: Answer-First UI - Show AnswerCard FIRST */}
      {showAiResponse && (
        <div className="mt-4 space-y-4">
          {/* Answer Card (Primary) */}
          {queryResult ? (
            <AnswerCard
              result={queryResult}
              onViewSource={(url) => {
                ipc.tabs.create(url).catch(console.error);
              }}
              onViewFullPage={(url) => {
                ipc.tabs.create(url).catch(console.error);
              }}
            />
          ) : (aiLoading || askingAboutPage) ? (
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Loader2 size={16} className="text-blue-400 animate-spin" />
                <span className="text-sm text-gray-300">
                  {askingAboutPage ? 'Analyzing page...' : 'Getting AI answer...'}
                </span>
              </div>
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-gray-700/50 rounded w-3/4"></div>
                <div className="h-4 bg-gray-700/50 rounded w-full"></div>
                <div className="h-4 bg-gray-700/50 rounded w-5/6"></div>
              </div>
            </div>
          ) : aiResponse ? (
            // Fallback: Show simple answer if QueryEngine not available
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-gray-300">AI Answer</h3>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {aiResponse}
                </div>
              </div>
            </div>
          ) : null}

          {llmResult && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleSaveAnswerToMemory}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saveStatus === 'saving'
                  ? 'Saving...'
                  : saveStatus === 'saved'
                  ? 'Saved'
                  : saveStatus === 'error'
                  ? 'Retry Save'
                  : 'Save to Memory'}
              </button>
            </div>
          )}
          
          {/* Search Results (Secondary - Collapsed by default) */}
          {allResults.length > 0 && (
            <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowSearchResults(!showSearchResults)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-300">
                    {allResults.length} search result{allResults.length > 1 ? 's' : ''} available
                  </span>
                  <span className="text-xs text-gray-500">
                    (Click to {showSearchResults ? 'hide' : 'view'} sources)
                  </span>
                </div>
                {showSearchResults ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </button>
              
              {showSearchResults && (
                <div className="border-t border-gray-800/50 max-h-[400px] overflow-y-auto">
                  {proxyResults.length > 0 && (
                    <div className="p-3 border-b border-gray-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe size={14} className="text-blue-400" />
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Web Results</h3>
                      </div>
                      <div className="space-y-1">
                        {proxyResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => handleResultClick(result)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <div className="text-sm font-medium text-white line-clamp-1">{result.title}</div>
                            {result.snippet && (
                              <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{result.snippet}</div>
                            )}
                            {result.url && (
                              <div className="text-xs text-gray-500 mt-1 truncate">{result.url}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {duckResults.length > 0 && (
                    <div className="p-3 border-b border-gray-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe size={14} className="text-blue-400" />
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Additional Results</h3>
                      </div>
                      <div className="space-y-1">
                        {duckResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => handleResultClick(result)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <div className="text-sm font-medium text-white line-clamp-1">{result.title}</div>
                            {result.snippet && (
                              <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{result.snippet}</div>
                            )}
                            {result.url && (
                              <div className="text-xs text-gray-500 mt-1 truncate">{result.url}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {localResults.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={14} className="text-green-400" />
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Local Docs</h3>
                      </div>
                      <div className="space-y-1">
                        {localResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => handleResultClick(result)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <div className="text-sm font-medium text-white line-clamp-1">{result.title}</div>
                            {result.snippet && (
                              <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{result.snippet}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/40 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

