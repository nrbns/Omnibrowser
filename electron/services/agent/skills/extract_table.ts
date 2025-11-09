import { registry } from './registry';
import { extractFirstTable, extractAllTables } from '../../extractors/table';
import { cfg } from '../../../config';
import { getPlaywrightChromium } from '../../utils/playwright';

async function fetchHtml(url: string) {
  const chromium = getPlaywrightChromium();
  if (!chromium) {
    throw new Error('Playwright automation is not available in this build. Install "playwright-core" to enable table extraction.');
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: cfg.userAgent });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs });
    const html = await page.content();
    return html;
  } finally {
    await page.close();
    await browser.close();
  }
}

// Extract first table (original)
registry.register('extract_table', async (_ctx, args: { url: string }) => {
  const html = await fetchHtml(args.url);
  const { headers, rows } = extractFirstTable(html);
  return { headers, rows, count: rows.length };
});

// Extract all tables (enhanced)
registry.register('extract_all_tables', async (_ctx, args: { url: string }) => {
  const html = await fetchHtml(args.url);
  const tables = extractAllTables(html);
  
  return {
    tables: tables.map((table, index) => ({
      index,
      headers: table.headers,
      rows: table.rows,
      rowCount: table.rows.length,
      columnCount: table.headers.length,
    })),
    totalTables: tables.length,
  };
});

// Extract specific table by index
registry.register('extract_table_by_index', async (_ctx, args: { url: string; index: number }) => {
  const html = await fetchHtml(args.url);
  const tables = extractAllTables(html);
  
  if (args.index < 0 || args.index >= tables.length) {
    throw new Error(`Table index ${args.index} out of range (0-${tables.length - 1})`);
  }

  const table = tables[args.index];
  return {
    index: args.index,
    headers: table.headers,
    rows: table.rows,
    rowCount: table.rows.length,
    columnCount: table.headers.length,
  };
});


