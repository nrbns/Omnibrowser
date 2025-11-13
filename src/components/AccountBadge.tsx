import { useEffect, useState } from 'react';

type Account = { id: string; name: string };

export default function AccountBadge() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [current, setCurrent] = useState<string>('default');
  useEffect(()=>{ (async ()=>{ const l = await (window as any).api?.storage?.listAccounts?.(); setAccounts(l||[]); })(); },[]);
  return (
    <select className="bg-neutral-800 rounded px-2 py-1 text-xs" value={current} onChange={(e)=> setCurrent(e.target.value)}>
      <option value="default">Default</option>
      {accounts.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
    </select>
  );
}

export async function openWithAccount(targetUrl: string, accountId: string) {
  try {
    if (!targetUrl || !targetUrl.trim()) {
      console.warn('[AccountBadge] Empty URL provided');
      return;
    }
    
    // Ensure URL is properly formatted
    const url = targetUrl.trim();
    
    if (accountId && accountId !== 'default') {
      const result = await (window as any).api?.tabs?.createWithProfile?.(accountId, url);
      if (!result || result.error) {
        console.error('[AccountBadge] Failed to create tab with profile:', result?.error);
        throw new Error(result?.error || 'Failed to create tab');
      }
    } else {
      const result = await (window as any).api?.tabs?.create?.(url);
      if (!result || result.error) {
        console.error('[AccountBadge] Failed to create tab:', result?.error);
        throw new Error(result?.error || 'Failed to create tab');
      }
    }
  } catch (error) {
    console.error('[AccountBadge] Error opening URL:', error);
    throw error;
  }
}


