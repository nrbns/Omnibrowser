/**
 * ResearchSplit - Reader + Notes split pane for Research mode
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, BookOpen, Save, X, PenLine, FileDown, Archive, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTabsStore } from '../../state/tabsStore';
import { ipc } from '../../lib/ipc-typed';
import { debounce } from 'lodash-es';
import { ResearchHighlight } from '../../types/research';
import { ipcEvents } from '../../lib/ipc-events';

export function ResearchSplit() {
  const { activeId } = useTabsStore();
  const [readerContent, setReaderContent] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [highlights, setHighlights] = useState<ResearchHighlight[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [exporting, setExporting] = useState<'markdown' | 'obsidian' | 'notion' | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  // Load content for current tab
  useEffect(() => {
    const loadContent = async () => {
      if (!activeId) {
        setReaderContent('');
        setCurrentUrl('');
        setNotes('');
        setHighlights([]);
        return;
      }

      try {
        const tabs = await ipc.tabs.list();
        const tab = tabs.find((t: any) => t.id === activeId);
        if (!tab?.url) {
          setReaderContent('');
          setCurrentUrl('');
          return;
        }

        const url = tab.url;
        setCurrentUrl(url);

        // Skip special pages
        if (url.startsWith('about:') || url.startsWith('chrome:')) {
          setReaderContent('');
          setNotes('');
          setHighlights([]);
          return;
        }

        // Load saved notes for this URL
        try {
          const saved = (await ipc.research.getNotes(url)) as { notes?: string; highlights?: ResearchHighlight[] };
          if (saved) {
            setNotes(saved.notes || '');
            if (Array.isArray(saved.highlights)) {
              const mapped = saved.highlights.map((h) => ({
                id: h.id || (crypto.randomUUID?.() ?? `hl-${Date.now()}`),
                text: h.text || '',
                color: h.color || '#facc15',
                createdAt: h.createdAt || Date.now(),
                note: h.note,
              }));
              setHighlights(mapped);
            } else {
              setHighlights([]);
            }
          }
        } catch (error) {
          console.error('Failed to load notes:', error);
        }

        // Extract readable content
        setReaderContent('Extracting readable content...');
        try {
          const result = await ipc.research.extractContent(activeId) as any;
          if (result?.html) {
            setReaderContent(result.html);
          } else if (result?.content) {
            // Fallback: show plain text if no HTML
            setReaderContent(`<div class="prose prose-invert"><h1>${result.title || url}</h1><p>${result.content}</p></div>`);
          } else {
            setReaderContent('');
          }
        } catch (error) {
          console.error('Failed to extract content:', error);
          setReaderContent('');
        }
      } catch (error) {
        console.error('Failed to load research content:', error);
        setReaderContent('');
      }
    };

    loadContent();
    
    // Listen for tab updates
    const handleTabUpdate = () => {
      loadContent();
    };
    
    if ((window.ipc as any)?.on) {
      (window.ipc as any).on('tabs:updated', handleTabUpdate);
      return () => {
        if ((window.ipc as any)?.removeListener) {
          (window.ipc as any).removeListener('tabs:updated', handleTabUpdate);
        }
      };
    }
  }, [activeId]);

  // Auto-save notes (debounced)
  const saveNotes = useRef(
    debounce(async (url: string, notesText: string, highlightsData: Highlight[]) => {
      if (!url || url.startsWith('about:') || url.startsWith('chrome:')) return;
      try {
        await ipc.research.saveNotes(url, notesText, highlightsData);
        console.log('Auto-saved notes for', url);
      } catch (error) {
        console.error('Failed to save notes:', error);
      }
    }, 1000)
  ).current;

  useEffect(() => {
    if (currentUrl && (notes || highlights.length > 0)) {
      saveNotes(currentUrl, notes, highlights);
    }
  }, [notes, highlights, currentUrl, saveNotes]);

  useEffect(() => {
    const unsubscribe = ipcEvents.on<{ url: string; highlight: ResearchHighlight }>('research:highlight-added', (payload) => {
      if (!payload?.url || payload.url !== currentUrl) return;
      setHighlights((prev) => [
        ...prev,
        {
          id: payload.highlight.id,
          text: payload.highlight.text,
          color: payload.highlight.color || '#facc15',
          createdAt: payload.highlight.createdAt || Date.now(),
          note: payload.highlight.note,
        },
      ]);
    });
    return unsubscribe;
  }, [currentUrl]);

  const handleHighlightNoteChange = (id: string, nextNote: string) => {
    setHighlights((prev) =>
      prev.map((highlight) =>
        highlight.id === id
          ? {
              ...highlight,
              note: nextNote,
            }
          : highlight,
      ),
    );
  };

  const sortedHighlights = useMemo(
    () => [...highlights].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [highlights],
  );

  const handleExport = async (format: 'markdown' | 'obsidian' | 'notion') => {
    if (!currentUrl || currentUrl.startsWith('about:') || currentUrl.startsWith('chrome:')) {
      return;
    }

    const maybeFlush = (saveNotes as any)?.flush;
    if (typeof maybeFlush === 'function') {
      maybeFlush();
    }

    try {
      await ipc.research.saveNotes(currentUrl, notes, highlights);
    } catch (error) {
      console.error('Failed to sync notes before export:', error);
    }

    setExporting(format);
    try {
      const result = await ipc.research.export(format, [currentUrl], true);
      if (result?.format === 'markdown' && result?.path) {
        alert(`Markdown exported to ${result.path}`);
      } else if (result?.format === 'obsidian' && result?.folder) {
        alert(`Obsidian vault files saved to ${result.folder}`);
      } else if (result?.format === 'notion' && Array.isArray(result?.notionPages)) {
        const pages = result.notionPages
          .map((page: any) => (page?.url ? `• ${page.title || 'Untitled'}\n  ${page.url}` : `• ${page.title || 'Untitled'}`))
          .join('\n');
        alert(`Synced to Notion:\n${pages}`);
      } else {
        alert('Export completed.');
      }
    } catch (error) {
      console.error('Failed to export:', error);
      const message = error instanceof Error ? error.message : 'Failed to export';
      alert(message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="h-full flex">
      {/* Reader Pane */}
      <div className="flex-1 flex flex-col border-r border-gray-700/30 bg-gray-950 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50 bg-gray-900/50">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Reader</span>
          </div>
        </div>
        <div
          ref={readerRef}
          className="flex-1 overflow-y-auto p-6 prose prose-invert max-w-none"
          style={{
            color: '#e5e7eb',
          }}
        >
          {readerContent ? (
            <div
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: readerContent }}
            />
          ) : (
            <div className="text-center text-gray-500 py-12">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p>No readable content available</p>
              <p className="text-xs mt-2">Navigate to a page to extract content</p>
            </div>
          )}
        </div>
      </div>

      {/* Notes Pane */}
      <div className="w-80 flex flex-col border-l border-gray-700/30 bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-green-400" />
            <span className="text-sm font-medium text-gray-300">Notes</span>
          </div>
          {currentUrl && (
            <motion.span
              className="text-xs text-gray-500 px-2 py-0.5 bg-gray-800/40 rounded"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Auto-saving...
            </motion.span>
          )}
        </div>

        {/* Highlights List */}
        {sortedHighlights.length > 0 && (
          <div className="border-b border-gray-800/50 p-3 space-y-3 max-h-52 overflow-y-auto">
            <div className="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-2">
              <PenLine size={12} />
              Highlights & notes
            </div>
            {sortedHighlights.map((highlight) => (
              <div key={highlight.id} className="bg-gray-800/30 rounded-lg border border-gray-800/60 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div
                    className="px-2 py-1 rounded-md text-xs font-medium max-w-xs truncate"
                    style={{ backgroundColor: `${highlight.color}20`, color: highlight.color }}
                    title={highlight.text}
                  >
                    {highlight.text.slice(0, 120)}
                    {highlight.text.length > 120 ? '…' : ''}
                  </div>
                  <button
                    onClick={() => setHighlights((prev) => prev.filter((h) => h.id !== highlight.id))}
                    className="p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors"
                    aria-label="Remove highlight"
                  >
                    <X size={12} />
                  </button>
                </div>
                <textarea
                  value={highlight.note ?? ''}
                  onChange={(e) => handleHighlightNoteChange(highlight.id, e.target.value)}
                  placeholder="Add a note for this highlight..."
                  className="w-full text-xs bg-gray-900/40 border border-gray-800/60 rounded-md px-2 py-1.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                  rows={2}
                />
                <div className="text-[10px] text-gray-500">
                  Saved {new Date(highlight.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes Editor */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Take notes, add insights, save findings..."
          className="flex-1 p-4 bg-transparent text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none"
        />

        {/* Footer Actions */}
        <div className="border-t border-gray-800/50 p-3 flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              if (currentUrl && !currentUrl.startsWith('about:') && !currentUrl.startsWith('chrome:')) {
                saveNotes.flush();
                try {
                  await ipc.research.saveNotes(currentUrl, notes, highlights);
                } catch (error) {
                  console.error('Failed to save notes:', error);
                }
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded text-xs text-blue-400 transition-colors"
          >
            <Save size={14} />
            Save
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!!exporting}
            onClick={() => handleExport('markdown')}
            className={`px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded text-xs text-green-400 transition-colors flex items-center gap-2 ${
              exporting ? 'opacity-60 cursor-wait' : ''
            }`}
            title="Export to Markdown"
          >
            <FileDown size={14} />
            {exporting === 'markdown' ? 'Exporting…' : 'Export Markdown'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!!exporting}
            onClick={() => handleExport('obsidian')}
            className={`px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded text-xs text-purple-300 transition-colors flex items-center gap-2 ${
              exporting ? 'opacity-60 cursor-wait' : ''
            }`}
            title="Export notes and highlights to Obsidian-compatible markdown files"
          >
            <Archive size={14} />
            {exporting === 'obsidian' ? 'Exporting…' : 'Obsidian Export'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!!exporting}
            onClick={() => handleExport('notion')}
            className={`px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded text-xs text-emerald-300 transition-colors flex items-center gap-2 ${
              exporting ? 'opacity-60 cursor-wait' : ''
            }`}
            title="Sync notes and highlights to Notion"
          >
            <Send size={14} />
            {exporting === 'notion' ? 'Exporting…' : 'Sync to Notion'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

