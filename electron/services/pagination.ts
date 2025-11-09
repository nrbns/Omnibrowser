import { cfg } from '../config';
import { getPlaywrightChromium } from './utils/playwright';

export async function paginateCollect(url: string, nextSelector: string, maxPages = 5) {
  const chromium = getPlaywrightChromium();
  if (!chromium) {
    throw new Error('Playwright automation is not available in this build. Install "playwright-core" to enable pagination automation.');
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: cfg.userAgent });
  const pages: string[] = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs });
    for (let i = 0; i < maxPages; i++) {
      pages.push(await page.content());
      const hasNext = await page.$(nextSelector);
      if (!hasNext) break;
      await hasNext.click();
      await page.waitForLoadState('domcontentloaded', { timeout: cfg.timeoutMs }).catch(()=>{});
    }
    return pages;
  } finally {
    await page.close();
    await browser.close();
  }
}


