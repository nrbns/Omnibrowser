import { useEffect, useMemo, useState } from 'react';
import { FilePlus, Globe, Loader2, Shield, UploadCloud, X } from 'lucide-react';
import { ipc } from '../../lib/ipc-typed';
import { DocumentReview } from '../../types/document-review';
import { PDFViewer } from '../../components/DocumentViewer/PDFViewer';
import { CommentsPanel, Comment } from '../../components/DocumentViewer/CommentsPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

type ViewMode = 'list' | 'review' | 'ingest';
type IngestType = 'pdf' | 'docx' | 'web';

export default function DocsPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [reviews, setReviews] = useState<DocumentReview[]>([]);
  const [activeReview, setActiveReview] = useState<DocumentReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingestType, setIngestType] = useState<IngestType>('pdf');
  const [ingestUrl, setIngestUrl] = useState('');
  const [fileToIngest, setFileToIngest] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const list = await ipc.document.list();
        setReviews(list as DocumentReview[]);
      } catch (err) {
        console.error('Failed to load document reviews', err);
      }
    };
    void loadReviews();
  }, []);

  const handleSelectReview = (review: DocumentReview) => {
    setActiveReview(review);
    setViewMode('review');
  };

  const handleStartIngest = (type: IngestType) => {
    setError(null);
    setUploadProgress(null);
    setFileToIngest(null);
    setIngestUrl('');
    setIngestType(type);
    setViewMode('ingest');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      setFileToIngest(file);
    }
  };

  const handleIngestCancel = () => {
    setViewMode(activeReview ? 'review' : 'list');
    setFileToIngest(null);
    setError(null);
  };

  const handleIngest = async () => {
    try {
      setLoading(true);
      setError(null);
      setUploadProgress(5);

      let payloadSource: string = '';
      let payloadType: IngestType = ingestType;

      if (ingestType === 'web') {
        if (!ingestUrl.trim()) {
          setError('Please enter a URL to ingest.');
          setLoading(false);
          return;
        }
        payloadSource = ingestUrl.trim();
      } else {
        if (!fileToIngest) {
          setError('Please choose a file to ingest.');
          setLoading(false);
          return;
        }
        const buffer = await fileToIngest.arrayBuffer();
        payloadSource = Buffer.from(buffer).toString('base64');
        payloadType = fileToIngest.name.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf';
      }

      setUploadProgress(30);
      const review = await ipc.document.ingest(payloadSource, payloadType, fileToIngest?.name || ingestUrl || undefined);
      setUploadProgress(90);

      const reviewData = review as DocumentReview;
      setReviews(prev => [reviewData, ...prev]);
      setActiveReview(reviewData);
      setViewMode('review');
    } catch (err: any) {
      console.error('Document ingest failed', err);
      setError(err?.message || 'Failed to ingest document.');
    } finally {
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 800);
      setLoading(false);
    }
  };

  const handleDeleteReview = async (review: DocumentReview) => {
    if (!confirm(`Delete "${review.title}"?`)) return;
    try {
      await ipc.document.delete({ id: review.id });
      setReviews(prev => prev.filter(r => r.id !== review.id));
      if (activeReview?.id === review.id) {
        setActiveReview(null);
        setViewMode('list');
      }
    } catch (err) {
      console.error('Failed to delete review', err);
    }
  };

  return (
    <div className="flex h-full bg-[#1A1D28] text-gray-100 overflow-hidden">
      <Sidebar
        reviews={reviews}
        activeReview={activeReview}
        onSelectReview={handleSelectReview}
        onCreate={handleStartIngest}
      />

      <main className="flex-1 overflow-y-auto">
        {viewMode === 'list' && (
          <EmptyState onCreate={handleStartIngest} />
        )}

        {viewMode === 'ingest' && (
          <IngestForm
            ingestType={ingestType}
            ingestUrl={ingestUrl}
            loading={loading}
            uploadProgress={uploadProgress}
            error={error}
            fileToIngest={fileToIngest}
            onTypeChange={setIngestType}
            onUrlChange={setIngestUrl}
            onFileSelect={handleFileSelect}
            onSubmit={handleIngest}
            onCancel={handleIngestCancel}
          />
        )}

        {viewMode === 'review' && activeReview && (
          <DocumentReviewView
            review={activeReview}
            onReverify={async () => {
              try {
                setLoading(true);
                const updated = await ipc.document.reverify({ id: activeReview.id });
                const newReview = updated as DocumentReview;
                setActiveReview(newReview);
                setReviews(prev => prev.map(r => (r.id === newReview.id ? newReview : r)));
              } catch (err) {
                console.error('Reverify failed', err);
              } finally {
                setLoading(false);
              }
            }}
            onExport={async (format, style) => {
              try {
                setLoading(true);
                const outputPath = window.prompt('Save to path', `~/Documents/${activeReview.title}.${format === 'markdown' ? 'md' : 'html'}`);
                if (!outputPath) return;
                await ipc.document.export(activeReview.id, format, outputPath, style);
                alert('Export completed successfully');
              } catch (err) {
                console.error('Export failed', err);
                alert('Export failed. Check console for details.');
              } finally {
                setLoading(false);
              }
            }}
            onDelete={() => activeReview && handleDeleteReview(activeReview)}
          />
        )}
      </main>
    </div>
  );
}

interface SidebarProps {
  reviews: DocumentReview[];
  activeReview: DocumentReview | null;
  onSelectReview(review: DocumentReview): void;
  onCreate(type: IngestType): void;
}

function Sidebar({ reviews, activeReview, onSelectReview, onCreate }: SidebarProps) {
  return (
    <aside className="w-80 border-r border-gray-800/40 bg-[#161924] flex flex-col">
      <div className="p-4 border-b border-gray-800/40">
        <h1 className="text-lg font-semibold">Document Review</h1>
        <p className="text-xs text-gray-500">Ingest, analyze, and verify documents</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => onCreate('pdf')}
            className="flex items-center justify-center gap-1 rounded border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-indigo-200 hover:bg-indigo-500/20"
          >
            <FilePlus size={12} />
            PDF
          </button>
          <button
            onClick={() => onCreate('docx')}
            className="flex items-center justify-center gap-1 rounded border border-purple-500/40 bg-purple-500/10 px-2 py-1 text-purple-200 hover:bg-purple-500/20"
          >
            <UploadCloud size={12} />
            DOCX
          </button>
          <button
            onClick={() => onCreate('web')}
            className="flex items-center justify-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-200 hover:bg-emerald-500/20"
          >
            <Globe size={12} />
            Web
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {reviews.length === 0 ? (
          <div className="p-4 text-xs text-gray-500">
            No documents yet. Ingest a PDF, DOCX, or web article to begin.
          </div>
        ) : (
          <ul>
            {reviews.map((review) => (
              <li key={review.id}>
                <button
                  onClick={() => onSelectReview(review)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors ${activeReview?.id === review.id ? 'bg-gray-800/50' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="uppercase tracking-wide text-[10px] text-gray-500">{review.type}</span>
                    <span>{formatDistanceToNow(review.updatedAt, { addSuffix: true })}</span>
                  </div>
                  <div className="mt-1 font-medium text-sm text-gray-100 line-clamp-2">{review.title}</div>
                  <div className="mt-2 text-[11px] text-gray-500">
                    {review.sections.length} sections • {review.claims.length} claims
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

interface EmptyStateProps {
  onCreate(type: IngestType): void;
}

function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-gray-400">
      <div className="rounded-full border border-dashed border-gray-700/60 bg-gray-800/30 p-6">
        <Shield size={48} className="text-purple-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-100">Start your first review</h2>
        <p>Upload a PDF/DOCX or ingest a web article to analyze claims, entities, and timelines.</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => onCreate('pdf')}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500 transition-colors"
        >
          Upload document
        </button>
        <button
          onClick={() => onCreate('web')}
          className="rounded border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-600"
        >
          Ingest web page
        </button>
      </div>
    </div>
  );
}

interface IngestFormProps {
  ingestType: IngestType;
  ingestUrl: string;
  loading: boolean;
  uploadProgress: number | null;
  error: string | null;
  fileToIngest: File | null;
  onTypeChange(type: IngestType): void;
  onUrlChange(value: string): void;
  onFileSelect(event: React.ChangeEvent<HTMLInputElement>): void;
  onSubmit(): void;
  onCancel(): void;
}

function IngestForm({
  ingestType,
  ingestUrl,
  loading,
  uploadProgress,
  error,
  fileToIngest,
  onTypeChange,
  onUrlChange,
  onFileSelect,
  onSubmit,
  onCancel,
}: IngestFormProps) {
  return (
    <div className="flex max-w-3xl flex-col gap-6 px-10 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-100">Ingest document</h2>
          <p className="text-sm text-gray-400">
            Ingest a file or web article to analyze claims and generate verification reports.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="rounded-full border border-gray-700 bg-gray-800/40 p-2 text-gray-400 hover:bg-gray-800/60"
        >
          <X size={16} />
        </button>
      </div>

      <div className="rounded border border-gray-800/60 bg-gray-900/40 p-6">
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Source type
        </label>
        <div className="flex gap-3">
          {(['pdf', 'docx', 'web'] as IngestType[]).map((type) => (
            <button
              key={type}
              onClick={() => onTypeChange(type)}
              className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                ingestType === type
                  ? 'border-purple-500/50 bg-purple-500/10 text-purple-200'
                  : 'border-gray-700/50 bg-gray-800/40 text-gray-300 hover:border-gray-600'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {ingestType === 'web' ? (
        <div className="rounded border border-gray-800/60 bg-gray-900/40 p-6">
          <label className="block text-sm font-medium text-gray-300">
            Web URL
          </label>
          <input
            type="url"
            value={ingestUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com/article"
            className="mt-2 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            OmniBrowser will fetch the article, strip boilerplate, and analyze claims.
          </p>
        </div>
      ) : (
        <div className="rounded border border-dashed border-gray-700 bg-gray-900/30 p-6 text-center">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Upload {ingestType.toUpperCase()} file
          </label>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={onFileSelect}
            className="mx-auto block text-sm text-gray-300"
          />
          {fileToIngest && (
            <p className="mt-3 text-xs text-gray-400">
              Selected: {fileToIngest.name} ({Math.round(fileToIngest.size / 1024)} KB)
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onSubmit}
          disabled={loading}
          className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-purple-500 disabled:opacity-50"
        >
          {loading ? 'Processing…' : 'Ingest'}
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-600"
        >
          Cancel
        </button>
        {uploadProgress !== null && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 size={14} className="animate-spin text-purple-400" />
            <span>Progress {uploadProgress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface DocumentReviewViewProps {
  review: DocumentReview;
  onReverify(): void;
  onExport(format: 'markdown' | 'html', style: 'apa' | 'mla' | 'chicago' | 'ieee' | 'harvard'): void;
  onDelete(): void;
}

function DocumentReviewView({ review, onReverify, onExport, onDelete }: DocumentReviewViewProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  useEffect(() => {
    if (review.type === 'pdf') {
      setPdfPath(`omnibrowser://document/${review.id}`);
    } else {
      setPdfPath(null);
    }
  }, [review]);

  const timeline = review.timeline ?? [];
  const verificationSummary = useMemo(() => {
    const total = review.claims.length;
    const verified = review.claims.filter(c => c.verification.status === 'verified').length;
    const disputed = review.claims.filter(c => c.verification.status === 'disputed').length;
    const unverified = total - verified - disputed;
    return {
      total,
      verified,
      disputed,
      unverified,
    };
  }, [review.claims]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between border-b border-gray-800/40 bg-gray-900/40 px-8 py-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-gray-100">{review.title}</h2>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {review.type.toUpperCase()} • {review.sections.length} sections • {review.entities.length} entities • {review.claims.length} claims
          </div>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>Created {formatDistanceToNow(review.createdAt, { addSuffix: true })}</span>
            <span>Updated {formatDistanceToNow(review.updatedAt, { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReverify}
            className="rounded border border-purple-500/50 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-200 hover:bg-purple-500/20"
          >
            Re-run verification
          </button>
          <button
            onClick={() => onExport('markdown', 'apa')}
            className="rounded border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-gray-500"
          >
            Export Markdown
          </button>
          <button
            onClick={() => onExport('html', 'apa')}
            className="rounded border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-gray-500"
          >
            Export HTML
          </button>
          <button
            onClick={onDelete}
            className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20"
          >
            Delete
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-gray-800/40 bg-[#181C27] overflow-y-auto">
          <section className="border-b border-gray-800/40 p-4">
            <span className="block text-xs uppercase tracking-wide text-gray-500">
              Verification summary
            </span>
            <div className="mt-3 space-y-2 text-xs">
              <SummaryRow label="Total claims" value={verificationSummary.total} />
              <SummaryRow label="Verified" value={verificationSummary.verified} tone="success" />
              <SummaryRow label="Disputed" value={verificationSummary.disputed} tone="warning" />
              <SummaryRow label="Unverified" value={verificationSummary.unverified} tone="neutral" />
            </div>
          </section>

          <section className="border-b border-gray-800/40 p-4">
            <span className="block text-xs uppercase tracking-wide text-gray-500 mb-3">
              Entities
            </span>
            <ul className="space-y-2 text-xs text-gray-400">
              {review.entities.map((entity) => (
                <li key={entity.name}>
                  <span className="font-medium text-gray-200">{entity.name}</span>
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-gray-500">{entity.type}</span>
                  <span className="ml-1 text-[10px] text-gray-600">
                    ({entity.occurrences.length})
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="p-4">
            <span className="block text-xs uppercase tracking-wide text-gray-500 mb-3">
              Timeline events
            </span>
            {timeline.length === 0 ? (
              <div className="text-xs text-gray-500">No events detected.</div>
            ) : (
              <ul className="space-y-2 text-xs text-gray-400">
                {timeline.map((event, idx) => (
                  <li key={`${event.date}-${idx}`}>
                    <div className="font-medium text-gray-200">{event.date}</div>
                    <div className="text-[11px]">{event.description}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="flex-1 overflow-y-auto">
          <article className="space-y-6 p-8">
            {review.sections.map((section, idx) => (
              <div key={section.title + idx} className="space-y-2">
                <h3 className={`font-semibold text-gray-100 text-${Math.max(2, 4 - Math.min(section.level, 3))}xl`}>
                  {section.title}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {section.content.trim()}
                </p>
              </div>
            ))}
          </article>
        </section>

        <aside className="w-96 border-l border-gray-800/40 bg-[#181C27] flex flex-col">
          <header className="flex items-center justify-between border-b border-gray-800/40 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-100">Claim verification</h3>
            <button
              onClick={() => setShowComments(!showComments)}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              {showComments ? 'Hide comments' : 'Show comments'}
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y divide-gray-800/40">
              {review.claims.map((claim) => (
                <motion.li
                  key={claim.id}
                  layout
                  className={`cursor-pointer px-5 py-4 hover:bg-gray-800/30 transition-colors ${
                    selectedClaimId === claim.id ? 'bg-gray-800/50' : ''
                  }`}
                  onClick={() => setSelectedClaimId(claim.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-gray-500">Claim</span>
                    <StatusPill status={claim.verification.status} />
                  </div>
                  <p className="mt-2 text-sm text-gray-200 leading-relaxed line-clamp-3">
                    {claim.text}
                  </p>
                  <div className="mt-2 text-[11px] text-gray-500">
                    Confidence {(claim.verification.confidence * 100).toFixed(0)}% • {claim.section || 'Unknown section'}
                  </div>
                  <div className="mt-3 space-y-1">
                    {claim.verification.sources.slice(0, 3).map((source, idx) => (
                      <div key={`${claim.id}-src-${idx}`} className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span className={source.supports ? 'text-emerald-400' : 'text-amber-400'}>
                          {source.supports ? 'Supports' : 'Disputes'}
                        </span>
                        <span className="line-clamp-1">{source.title}</span>
                      </div>
                    ))}
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>

          {showComments && (
            <CommentsPanel
              comments={comments}
              onAddComment={(comment) => {
                setComments((prev) => [
                  ...prev,
                  {
                    id: `comment_${Date.now()}`,
                    createdAt: Date.now(),
                    ...comment,
                  },
                ]);
              }}
              onDeleteComment={(id) => setComments((prev) => prev.filter((comment) => comment.id !== id))}
              currentPage={1}
            />
          )}
        </aside>
      </div>

      {pdfPath && (
        <AnimatePresence>
          <motion.div
            key="pdf"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-6 z-50 overflow-hidden rounded-xl border border-gray-700/70 bg-[#0F131F]/95 shadow-2xl backdrop-blur"
          >
            <header className="flex items-center justify-between border-b border-gray-800/60 px-4 py-2 text-sm text-gray-300">
              <span>Document viewer</span>
              <button
                onClick={() => setPdfPath(null)}
                className="rounded-full border border-gray-700 bg-gray-800/50 p-1 text-gray-400 hover:bg-gray-800/70"
              >
                <X size={14} />
              </button>
            </header>
            <PDFViewer filePath={pdfPath} onPageChange={() => {}} />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const color =
    tone === 'success'
      ? 'text-emerald-300'
      : tone === 'warning'
      ? 'text-amber-300'
      : 'text-gray-300';
  return (
    <div className="flex items-center justify-between text-xs text-gray-400">
      <span>{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: DocumentReview['claims'][number]['verification']['status'] }) {
  const tone =
    status === 'verified'
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30'
      : status === 'disputed'
      ? 'bg-amber-500/10 text-amber-200 border-amber-500/30'
      : 'bg-gray-500/10 text-gray-300 border-gray-500/30';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}
