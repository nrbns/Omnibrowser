export function extractFirstTable(html: string) {
  // naive regex-based; replace with DOM parse later
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return { headers: [], rows: [] };
  const headerMatches = [...tableMatch[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>strip(m[1]));
  const rowMatches = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1).map(m=>m[1]);
  const rows = rowMatches.map(r => [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>strip(m[1])));
  return { headers: headerMatches, rows };
}

export function extractAllTables(html: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)];
  
  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[0];
    const headerMatches = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => strip(m[1]));
    const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1).map(m => m[1]);
    const rows = rowMatches.map(r => [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => strip(m[1])));
    
    tables.push({ headers: headerMatches, rows });
  }
  
  return tables;
}

function strip(s: string) {
  return s.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
}


