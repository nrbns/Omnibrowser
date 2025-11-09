import { test, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from 'playwright';

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      PLAYWRIGHT: '1',
    },
  });

  const page = await app.firstWindow();

  await page.waitForFunction(() => {
    return Boolean(
      window.ipc &&
        typeof window.ipc.tabs === 'object' &&
        typeof window.ipc.tabs.list === 'function' &&
        document.querySelector('button[aria-label="New tab"]'),
    );
  }, { timeout: 20_000 });

  return { app, page };
}

async function getTabIds(page: Page): Promise<string[]> {
  return page.$$eval('[data-tab]', (elements) =>
    elements
      .map((el) => el.getAttribute('data-tab') || '')
      .filter((value): value is string => Boolean(value)),
  );
}

async function getActiveTabId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.querySelector('[data-tab][aria-selected="true"]');
    return active?.getAttribute('data-tab') ?? null;
  });
}

test.describe('Electron smoke suite', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeEach(async () => {
    ({ app, page } = await launchApp());
  });

  test.afterEach(async () => {
    await app.close();
  });

  test('new tab button creates tabs and middle-click closes them', async () => {
    const initialIds = await getTabIds(page);

    await page.click('button[aria-label="New tab"]');

    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('[data-tab]').length > expectedCount,
      initialIds.length,
    );

    const afterCreate = await getTabIds(page);
    expect(afterCreate.length).toBeGreaterThan(initialIds.length);

    const newestTabId = afterCreate[afterCreate.length - 1];
    expect(newestTabId).toBeTruthy();

    await page.dispatchEvent(`[data-tab="${newestTabId}"]`, 'auxclick', { button: 1 });

    await page.waitForFunction(
      (id) => !document.querySelector(`[data-tab="${id}"]`),
      newestTabId,
    );
  });

  test('tab keyboard navigation supports Arrow keys, Home, and End', async () => {
    for (let i = 0; i < 3; i += 1) {
      await page.click('button[aria-label="New tab"]');
    }

    await page.waitForFunction(() => document.querySelectorAll('[data-tab]').length >= 3);

    const tabIds = await getTabIds(page);
    expect(tabIds.length).toBeGreaterThanOrEqual(3);

    await page.click(`[data-tab="${tabIds[0]}"]`);
    expect(await getActiveTabId(page)).toBe(tabIds[0]);

    await page.keyboard.press('ArrowRight');
    expect(await getActiveTabId(page)).toBe(tabIds[1]);

    await page.keyboard.press('End');
    expect(await getActiveTabId(page)).toBe(tabIds[tabIds.length - 1]);

    await page.keyboard.press('Home');
    expect(await getActiveTabId(page)).toBe(tabIds[0]);
  });

  test('active tab scrolls into view when overflowing', async () => {
    for (let i = 0; i < 10; i += 1) {
      await page.click('button[aria-label="New tab"]');
    }

    await page.waitForFunction(() => document.querySelectorAll('[data-tab]').length >= 10);

    const tabIds = await getTabIds(page);
    const lastTabId = tabIds[tabIds.length - 1];

    await page.click(`[data-tab="${lastTabId}"]`);
    await page.waitForTimeout(200);

    const visibilityCheck = await page.evaluate(() => {
      const tablist = document.querySelector('[role="tablist"]') as HTMLElement | null;
      const active = tablist?.querySelector('[aria-selected="true"]') as HTMLElement | null;
      if (!tablist || !active) {
        return { visible: false, overflowed: false };
      }
      const overflowed = tablist.scrollWidth > tablist.clientWidth + 8;
      const rect = active.getBoundingClientRect();
      const containerRect = tablist.getBoundingClientRect();
      const visible = rect.left >= containerRect.left - 2 && rect.right <= containerRect.right + 2;
      return { visible, overflowed };
    });

    expect(visibilityCheck.overflowed).toBeTruthy();
    expect(visibilityCheck.visible).toBeTruthy();
  });
});
