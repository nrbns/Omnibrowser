import { useMemo, useState } from 'react';
import { useSettingsStore } from '../../state/settingsStore';
import VoiceButton from '../../components/VoiceButton';
import { ipc } from '../../lib/ipc-typed';
import { useTabsStore } from '../../state/tabsStore';
import {
  ResearchResult,
  ResearchSource,
  ResearchSourceType,
  VerificationResult,
} from '../../types/research';

export default function ResearchPanel() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [includeCounterpoints, setIncludeCounterpoints] = useState(false);
  const [authorityBias, setAuthorityBias] = useState(50); // 0 = recency, 100 = authority
  const [region, setRegion] = useState<RegionOption>('global');
  const { activeId } = useTabsStore();
  const useHybridSearch = useSettingsStore((s) => s.searchEngine !== 'mock');

  const recencyWeight = useMemo(() => (100 - authorityBias) / 100, [authorityBias]);
  const authorityWeight = useMemo(() => authorityBias / 100, [authorityBias]);

  const handleSearch = async (input?: string) => {
    const searchQuery = typeof input === 'string' ? input : query;
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (!useHybridSearch) {
        setResult(generateMockResult(searchQuery));
        return;
      }

      const response = await ipc.research.queryEnhanced(searchQuery, {
        maxSources: 12,
        includeCounterpoints,
        region: region !== 'global' ? region : undefined,
        recencyWeight,
        authorityWeight,
      });
      setResult(response);
    } catch (err) {
      console.error('Research query failed:', err);
      setError('Unable to complete the research request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      if (activeId) {
        await ipc.tabs.navigate(activeId, url);
      } else {
        await ipc.tabs.create(url);
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  return (
    <div className="p-3 space-y-2">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await handleSearch();
        }}
        className="flex items-center gap-2"
      >
        <input
          className="w-full bg-neutral-800 rounded px-3 py-2 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question or search..."
          disabled={loading}
        />
        <VoiceButton
          onResult={(text) => {
            setQuery(text);
            setTimeout(() => handleSearch(text), 100);
          }}
          small
        />
      </form>

      <ResearchControls
        authorityBias={authorityBias}
        includeCounterpoints={includeCounterpoints}
        region={region}
        loading={loading}
        onAuthorityBiasChange={setAuthorityBias}
        onIncludeCounterpointsChange={setIncludeCounterpoints}
        onRegionChange={(value) => setRegion(value)}
      />

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-400 text-center py-2">
          Gathering sources and generating answer...
        </div>
      )}

      {!loading && result && (
        <ResearchResultView
          result={result}
          onOpenSource={handleOpenUrl}
        />
      )}
    </div>
  );
}

type RegionOption = 'global' | 'us' | 'uk' | 'eu' | 'asia' | 'custom';

const REGION_OPTIONS: Array<{ value: RegionOption; label: string }> = [
  { value: 'global', label: 'Global' },
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'eu', label: 'Europe' },
  { value: 'asia', label: 'Asia Pacific' },
];

const SOURCE_BADGE_STYLES: Record<ResearchSourceType, string> = {
  news: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  academic: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  documentation: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  forum: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  other: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
};

interface ResearchControlsProps {
  authorityBias: number;
  includeCounterpoints: boolean;
  region: RegionOption;
  loading: boolean;
  onAuthorityBiasChange(value: number): void;
  onIncludeCounterpointsChange(value: boolean): void;
  onRegionChange(value: RegionOption): void;
}

function ResearchControls({
  authorityBias,
  includeCounterpoints,
  region,
  loading,
  onAuthorityBiasChange,
  onIncludeCounterpointsChange,
  onRegionChange,
}: ResearchControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs text-gray-300">
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-gray-400">Recency vs Authority</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Recency</span>
          <input
            type="range"
            min={0}
            max={100}
            value={authorityBias}
            disabled={loading}
            onChange={(e) => onAuthorityBiasChange(Number(e.target.value))}
          />
          <span className="text-[11px] text-gray-500">Authority</span>
          <span className="text-[11px] text-indigo-300">
            {authorityBias}%
          </span>
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={includeCounterpoints}
          disabled={loading}
          onChange={(e) => onIncludeCounterpointsChange(e.target.checked)}
        />
        Include counterpoints
      </label>

      <label className="flex items-center gap-2">
        Region
        <select
          value={region}
          disabled={loading}
          onChange={(e) => onRegionChange(e.target.value as RegionOption)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-gray-200"
        >
          {REGION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

interface ResearchResultViewProps {
  result: ResearchResult;
  onOpenSource(url: string): void;
}

function ResearchResultView({ result, onOpenSource }: ResearchResultViewProps) {
  const confidencePercent = Math.round(result.confidence * 100);
  const verification = result.verification;

  return (
    <div className="space-y-4">
      <section className="rounded border border-neutral-800 bg-neutral-900/60 p-4">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">
              AI Answer
            </h2>
            <p className="text-xs text-gray-500">
              {result.sources.length} sources considered • Confidence {confidencePercent}%
            </p>
          </div>
          {verification && (
            <span
              className={`text-xs font-medium px-2 py-1 rounded border ${
                verification.verified
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              }`}
            >
              {verification.verified ? 'Verified' : 'Needs review'}
            </span>
          )}
        </header>
        <div className="space-y-3 text-sm text-gray-200 leading-relaxed">
          {result.summary.split(/\n{2,}/).map((paragraph, idx) => (
            <p key={idx}>{paragraph.trim()}</p>
          ))}
        </div>

        {result.citations.length > 0 && (
          <div className="mt-4 border-t border-neutral-800 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Citations
            </h3>
            <ul className="space-y-2">
              {result.citations.map((citation) => {
                const source = result.sources[citation.sourceIndex];
                if (!source) return null;
                return (
                  <li key={citation.index} className="text-xs text-gray-400">
                    <button
                      className="font-medium text-indigo-300 hover:text-indigo-200"
                      onClick={() => onOpenSource(source.url)}
                    >
                      [{citation.index}] {source.title}
                    </button>
                    <div className="text-[11px] text-gray-500">
                      Confidence {(citation.confidence * 100).toFixed(0)}% • {source.domain}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {verification && (
        <VerificationSummary verification={verification} sources={result.sources} />
      )}

      {result.contradictions && result.contradictions.length > 0 && (
        <section className="rounded border border-neutral-800 bg-neutral-900/40 p-4">
          <h3 className="text-sm font-semibold text-amber-300 mb-2">
            Potential Counterpoints
          </h3>
          <ul className="space-y-2 text-xs text-gray-400">
            {result.contradictions.map((item, idx) => (
              <li key={`${item.claim}-${idx}`}>
                <div className="font-medium text-gray-200">{item.claim}</div>
                <div className="text-[11px] text-gray-500">
                  Sources:{' '}
                  {item.sources
                    .map((sourceIndex) => result.sources[sourceIndex]?.domain)
                    .filter(Boolean)
                    .join(', ')}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded border border-neutral-800 bg-neutral-900/40">
        <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-200">
            Sources ({result.sources.length})
          </h3>
          <span className="text-xs text-gray-500">
            Ranked by relevance & consensus
          </span>
        </header>
        <ul className="divide-y divide-neutral-800">
          {result.sources.map((source, idx) => (
            <li key={source.url || idx} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-200">{source.title}</span>
                  <span className="text-xs text-gray-500">{source.domain}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full border ${SOURCE_BADGE_STYLES[source.sourceType]}`}
                  >
                    {source.sourceType}
                  </span>
                  <span className="text-gray-400">
                    Relevance {source.relevanceScore.toFixed(0)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                {source.snippet || source.text.slice(0, 200)}
                {source.text.length > 200 ? '…' : ''}
              </p>
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300"
                onClick={() => onOpenSource(source.url)}
              >
                Open source ↗
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

interface VerificationSummaryProps {
  verification: VerificationResult;
  sources: ResearchSource[];
}

function VerificationSummary({ verification }: VerificationSummaryProps) {
  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-200">
          Verification summary
        </h3>
        <span
          className={`text-xs font-medium px-2 py-1 rounded border ${
            verification.verified
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
          }`}
        >
          {verification.verified ? 'Pass' : 'Review suggested'}
        </span>
      </div>

      <div className="grid gap-3 text-xs text-gray-300 sm:grid-cols-4">
        <Metric label="Claim density" value={`${verification.claimDensity.toFixed(1)} / 100 words`} />
        <Metric label="Citation coverage" value={`${verification.citationCoverage.toFixed(0)}%`} />
        <Metric label="Hallucination risk" value={`${(verification.hallucinationRisk * 100).toFixed(0)}%`} />
        <Metric label="Ungrounded claims" value={`${verification.ungroundedClaims.length}`} />
      </div>

      {verification.ungroundedClaims.length > 0 && (
        <details className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <summary className="cursor-pointer font-semibold text-amber-300">
            Ungrounded claims ({verification.ungroundedClaims.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[11px] text-amber-100">
            {verification.ungroundedClaims.map((claim, idx) => (
              <li key={`${claim.position}-${idx}`}>
                <span className="font-medium capitalize">{claim.severity}</span>: {claim.text}
              </li>
            ))}
          </ul>
        </details>
      )}

      {verification.suggestions.length > 0 && (
        <div className="space-y-1 text-xs text-gray-300">
          <h4 className="font-semibold text-gray-200">Suggestions</h4>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            {verification.suggestions.map((suggestion, idx) => (
              <li key={`${suggestion}-${idx}`}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded border border-neutral-800 bg-neutral-950/60 p-3">
      <span className="text-[11px] uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-200">{value}</span>
    </div>
  );
}

function generateMockResult(query: string): ResearchResult {
  const mockSources: ResearchSource[] = [
    {
      url: 'https://example.com/research',
      title: `Overview of ${query}`,
      text: `Mock content discussing ${query}.`,
      snippet: `A concise overview of ${query} with supporting context.`,
      domain: 'example.com',
      relevanceScore: 68,
      sourceType: 'documentation',
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
    },
    {
      url: 'https://knowledge.example.org/article',
      title: `In-depth analysis of ${query}`,
      text: `Extended mock analysis for ${query}.`,
      snippet: `Detailed analysis exploring key aspects of ${query}.`,
      domain: 'knowledge.example.org',
      relevanceScore: 72,
      sourceType: 'academic',
      timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
    },
  ];

  const mockVerification: VerificationResult = {
    verified: true,
    claimDensity: 8.5,
    citationCoverage: 92,
    ungroundedClaims: [],
    hallucinationRisk: 0.1,
    suggestions: ['Mock verification successful.'],
  };

  return {
    query,
    sources: mockSources,
    summary: `This is a mock summary for "${query}". The real-time retrieval engine is disabled, so these results are synthetic.\n\nConsider enabling hybrid search to see live research results with citations and verification.`,
    citations: mockSources.map((source, idx) => ({
      index: idx + 1,
      sourceIndex: idx,
      quote: source.snippet.slice(0, 90),
      confidence: 0.6 + idx * 0.1,
    })),
    confidence: 0.45,
    verification: mockVerification,
  };
}

