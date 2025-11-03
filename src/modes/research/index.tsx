import { useState } from 'react';
import { MockResearchProvider, HybridSearchProvider } from './provider';
import { useSettingsStore } from '../../state/settingsStore';
import VoiceButton from '../../components/VoiceButton';
import { ipc } from '../../lib/ipc-typed';
import { useTabsStore } from '../../state/tabsStore';

export default function ResearchPanel() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ title: string; url: string }[]>([]);
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { activeId } = useTabsStore();
  const useHybridSearch = useSettingsStore((s) => s.searchEngine !== 'mock'); // Use real search when not mock
  const provider = useHybridSearch ? new HybridSearchProvider() : new MockResearchProvider();

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setLoading(true);
    setAnswer('');
    setResults([]);

    try {
      // Get search results from hybrid search
      const searchResults = await provider.search(query);
      setResults(searchResults);

      // Get AI answer with RAG
      if (provider instanceof HybridSearchProvider && provider.getAnswer) {
        try {
          const answerResult = await provider.getAnswer(query);
          setAnswer(answerResult.answer);
        } catch (error) {
          console.error('Failed to get AI answer:', error);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
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
          await handleSearch(q); 
        }} 
        className="flex items-center gap-2"
      >
        <input 
          className="w-full bg-neutral-800 rounded px-3 py-2 text-sm" 
          value={q} 
          onChange={(e)=>setQ(e.target.value)} 
          placeholder="Ask a question or search..." 
          disabled={loading}
        />
        <VoiceButton onResult={(t)=>{ setQ(t); setTimeout(() => handleSearch(t), 100); }} small />
      </form>
      
      {loading && (
        <div className="text-sm text-gray-400 text-center py-2">Searching...</div>
      )}

      {answer && (
        <div className="border border-neutral-800 rounded p-3 text-sm whitespace-pre-wrap bg-neutral-900/50">
          <div className="font-medium text-gray-300 mb-2">AI Answer:</div>
          <div className="text-gray-400">{answer}</div>
        </div>
      )}
      
      {results.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-400 mb-2">Search Results ({results.length}):</div>
          <ul className="space-y-1">
            {results.map((r, idx)=> (
              <li key={r.url || idx} className="text-sm">
                <a 
                  className="text-indigo-400 hover:text-indigo-300 cursor-pointer" 
                  onClick={(e)=>{ 
                    e.preventDefault(); 
                    handleOpenUrl(r.url); 
                  }}
                >
                  {r.title}
                </a>
                {r.url && (
                  <div className="text-xs text-gray-500 truncate">{r.url}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


