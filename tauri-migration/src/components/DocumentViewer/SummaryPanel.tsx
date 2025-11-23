/**
 * Summary Panel UI - Display AI-generated summary
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Loader2, Copy, Check } from 'lucide-react';

interface SummaryPanelProps {
  filePath: string;
}

export function SummaryPanel({ filePath }: SummaryPanelProps) {
  const [summary, setSummary] = useState<string>('');
  const [citations, setCitations] = useState<Array<{ id: string; text: string; hash: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (filePath) {
      loadSummary();
    }
  }, [filePath]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      // Use HTTP API for PDF summarization
      const response = await fetch('http://127.0.0.1:4000/api/pdf/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          maxLength: 500,
          includeCitations: true,
        }),
      });
      const result = await response.json();

      if (result?.ok && result.data) {
        setSummary(result.data.summary || '');
        setCitations(result.data.citations || []);
      }
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const copySummary = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-96 h-full bg-gray-800 border-l border-gray-700 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-200">AI Summary</h3>
        </div>
        {summary && (
          <button
            onClick={copySummary}
            className="p-1.5 rounded hover:bg-gray-700"
            title="Copy summary"
          >
            {copied ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <Copy size={16} className="text-gray-400" />
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="text-gray-400 animate-spin" />
          </div>
        ) : summary ? (
          <div className="space-y-4">
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-gray-200 leading-relaxed">{summary}</p>
            </div>

            {citations.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h4 className="text-xs font-semibold text-gray-400 mb-2">Citations</h4>
                <div className="space-y-2">
                  {citations.map((citation) => (
                    <motion.div
                      key={citation.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-gray-400 p-2 bg-gray-700/30 rounded border border-gray-600/50"
                    >
                      <p className="text-gray-300">{citation.text.substring(0, 100)}...</p>
                      <code className="text-xs text-gray-500 mt-1">#{citation.hash.substring(0, 8)}</code>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm py-8">
            No summary available. Click to generate.
          </div>
        )}
      </div>
    </div>
  );
}

