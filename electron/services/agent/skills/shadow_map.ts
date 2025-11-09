import { registry } from './registry';
import { cfg } from '../../../config';
import { getPlaywrightChromium } from '../../utils/playwright';

function getSelectorJS(){
  return `function getSel(el){if(el.id)return '#'+el.id;const p=el.parentElement; if(!p) return el.tagName.toLowerCase(); const idx=[...p.children].indexOf(el)+1; return getSel(p)+'>'+el.tagName.toLowerCase()+':nth-child('+idx+')';}`;
}

registry.register('shadow_map', async (_ctx, { url }: { url: string }) => {
  const chromium = getPlaywrightChromium();
  if (!chromium) {
    throw new Error('Playwright automation is not available in this build. Install "playwright-core" to enable shadow_map.');
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: cfg.userAgent });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs });
    const affordances = await page.evaluate((getSelector)=>{
      const getSel = eval('('+getSelector+')');
      const clickable = Array.from(document.querySelectorAll('a,button,[role=button],input[type=submit]')).slice(0,200).map((el)=>({
        text: (el as HTMLElement).innerText?.trim().slice(0,80) || (el as HTMLElement).getAttribute('aria-label') || el.tagName,
        sel: getSel(el)
      }));
      return { clickable, forms: document.forms.length, filters: document.querySelectorAll('select').length };
    }, getSelectorJS());
    return affordances;
  } finally {
    await page.close();
    await browser.close();
  }
});


