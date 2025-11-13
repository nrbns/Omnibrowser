import { useState } from 'react';
import { useSettingsStore } from '../state/settingsStore';
import { normalizeInputToUrlOrSearch, buildSearchUrl } from '../lib/search';
import { openWithAccount } from './AccountBadge';
import VoiceButton from './VoiceButton';

export default function OmniSearch() {
  const [q, setQ] = useState('');
  const engine = useSettingsStore(s => s.searchEngine);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    
    try {
      // Prefer creating in selected account profile for isolation
      const select = document.querySelector('select.bg-neutral-800.rounded.px-2.py-1.text-xs') as HTMLSelectElement | null;
      const accountId = select?.value || 'default';
      
      if (engine === 'all') {
        const providers: any[] = ['google','bing','duckduckgo','yahoo'];
        for (const p of providers) {
          const url = buildSearchUrl(p as any, query);
          await openWithAccount(url, accountId);
        }
      } else {
        const target = normalizeInputToUrlOrSearch(query, engine as any) as string;
        if (target) {
          await openWithAccount(target, accountId);
        }
      }
      
      // Clear input after successful submission
      setQ('');
    } catch (error) {
      console.error('[OmniSearch] Failed to open URL:', error);
      // Keep the query in the input so user can retry
    }
  };
  return (
    <form onSubmit={onSubmit} className="flex-1 flex items-center" role="search" aria-label="Omnibox search">
      <input
        type="text"
        className="w-full bg-neutral-800 rounded px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500"
        placeholder="Type a URL or query"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const host = q.trim();
            if (!host) return;
            try {
              const hasScheme = /^https?:\/\//i.test(host);
              const hasTld = /\.[a-z]{2,}$/i.test(host);
              const url = (hasScheme || hasTld) ? host : `https://${host}.com`;
              const select = document.querySelector('select.bg-neutral-800.rounded.px-2.py-1.text-xs') as HTMLSelectElement | null;
              const accountId = select?.value || 'default';
              await openWithAccount(url, accountId);
              setQ(''); // Clear input after successful submission
            } catch (error) {
              console.error('[OmniSearch] Failed to open URL:', error);
            }
          }
        }}
        aria-label="Search or enter URL"
        aria-describedby="search-hint"
      />
      <span id="search-hint" className="sr-only">Press Ctrl+Enter or Cmd+Enter to open in new tab</span>
      <VoiceButton onResult={async (text)=>{ 
        setQ(text); 
        // Trigger form submission after setting query
        setTimeout(async () => {
          const form = document.querySelector('form[role="search"]') as HTMLFormElement;
          if (form) {
            const event = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(event);
            await onSubmit(event as any);
          }
        }, 100);
      }} small />
    </form>
  );
}


