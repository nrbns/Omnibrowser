type PlaywrightModule = typeof import('playwright-core');

let cachedPlaywright: PlaywrightModule | null = null;
let playwrightLoadAttempted = false;

function loadPlaywrightSync(): PlaywrightModule | null {
  if (cachedPlaywright) {
    return cachedPlaywright;
  }
  if (playwrightLoadAttempted) {
    return null;
  }
  playwrightLoadAttempted = true;
  try {
    // Use eval to avoid static analysis bundling the module when optional.
    const dynamicRequire = eval('require') as NodeRequire;
    cachedPlaywright = dynamicRequire('playwright-core') as PlaywrightModule;
    return cachedPlaywright;
  } catch (error) {
    console.warn(
      '[playwright] Optional dependency "playwright-core" not available. Browser automation features will be disabled.',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export function getPlaywrightChromium() {
  const playwright = loadPlaywrightSync();
  return playwright?.chromium ?? null;
}

export type PlaywrightPage = import('playwright-core').Page;


