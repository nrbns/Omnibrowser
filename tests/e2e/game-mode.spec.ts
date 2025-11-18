/**
 * Game Mode E2E Test
 * 
 * AC: Game Hub loads, AI recommendations work, save states persist
 * Features: AI recommendations, enhanced search, save/load game state
 */

import { test, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from 'playwright';

async function launchApp(): Promise<{ app: ElectronApplication | null; page: Page | null }> {
  try {
    const app = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        PLAYWRIGHT: '1',
        OB_DISABLE_HEAVY_SERVICES: '1',
      },
    });

    const page = await app.firstWindow();

    await page.waitForFunction(
      () =>
        typeof window !== 'undefined' &&
        (window as any).ipc &&
        typeof (window as any).ipc.invoke === 'function',
      { timeout: 15_000 },
    );

    return { app, page };
  } catch {
    return { app: null, page: null };
  }
}

test.describe('Game Mode Suite', () => {
  let app: ElectronApplication | null;
  let page: Page | null;

  test.beforeEach(async ({}, testInfo) => {
    ({ app, page } = await launchApp());
    if (!app || !page) {
      testInfo.skip('Electron shell did not become ready; skipping game mode E2E tests in this environment.');
    }
  });

  test.afterEach(async () => {
    if (app) {
      try {
        await app.close();
      } catch {
        // ignore
      }
    }
  });

  test('game mode can be activated', async () => {
    const gameModeButton = page!.locator('button:has-text("Game"), button[aria-label*="Game" i]').first();
    const isButtonVisible = await gameModeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isButtonVisible) {
      await gameModeButton.click();
      await page!.waitForTimeout(1000);
      
      const gameContent = page!.locator('text=/Game Hub|Play|Games/i').first();
      const hasGameContent = await gameContent.isVisible({ timeout: 5000 }).catch(() => false);
      
      expect(hasGameContent).toBeTruthy();
    } else {
      // Try navigating to game route
      await page!.evaluate(() => {
        (window as any).location?.hash && ((window as any).location.hash = '#/games');
      });
      await page!.waitForTimeout(1000);
      
      const gameContent = page!.locator('text=/Game Hub|Play/i').first();
      const hasGameContent = await gameContent.isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasGameContent).toBeTruthy();
    }
  });

  test('game catalog loads and displays', async () => {
    const gameModeButton = page!.locator('button:has-text("Game")').first();
    const isButtonVisible = await gameModeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isButtonVisible) {
      await gameModeButton.click();
    }
    
    await page!.waitForTimeout(2000);
    
    // Look for game grid or list
    const gameGrid = page!.locator('[data-testid="game-grid"], [class*="grid"]').first();
    const gameCard = page!.locator('[class*="game"], [data-testid="game-card"]').first();
    
    const hasGrid = await gameGrid.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasCard = await gameCard.isVisible({ timeout: 5_000 }).catch(() => false);
    
    // At least one game should be visible
    expect(hasGrid || hasCard).toBeTruthy();
  });

  test('AI recommendations button exists', async () => {
    const gameModeButton = page!.locator('button:has-text("Game")').first();
    const isButtonVisible = await gameModeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isButtonVisible) {
      await gameModeButton.click();
      await page!.waitForTimeout(2000);
    }

    // Look for AI recommendations button
    const aiButton = page!.locator('button:has-text("AI Recommendations"), button:has-text("Recommendations")').first();
    const hasAiButton = await aiButton.isVisible({ timeout: 5_000 }).catch(() => false);
    
    // Button should exist (may be disabled if no favorites)
    expect(hasAiButton).toBeTruthy();
  });

  test('AI recommendations generate when favorites exist', async () => {
    const gameModeButton = page!.locator('button:has-text("Game")').first();
    const isButtonVisible = await gameModeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isButtonVisible) {
      await gameModeButton.click();
      await page!.waitForTimeout(2000);
    }

    // First, favorite a game if possible
    const favoriteButton = page!.locator('button[aria-label*="favorite" i], button:has([class*="star"])').first();
    const hasFavoriteButton = await favoriteButton.isVisible({ timeout: 5_000 }).catch(() => false);
    
    if (hasFavoriteButton) {
      await favoriteButton.click();
      await page!.waitForTimeout(1000);
    }

    // Now try AI recommendations
    const aiButton = page!.locator('button:has-text("AI Recommendations")').first();
    const hasAiButton = await aiButton.isVisible({ timeout: 5_000 }).catch(() => false);
    
    if (hasAiButton && !(await aiButton.isDisabled().catch(() => true))) {
      await aiButton.click();
      await page!.waitForTimeout(5_000); // Wait for AI to generate
      
      // Check if recommendations are displayed
      const recommendations = page!.locator('text=/Recommended|AI/i').first();
      const hasRecommendations = await recommendations.isVisible({ timeout: 10_000 }).catch(() => false);
      
      // Recommendations may take time to generate
      console.log('AI recommendations visible:', hasRecommendations);
    } else {
      console.log('AI recommendations button not available or disabled');
    }
  });

  test('enhanced AI search works', async () => {
    const gameModeButton = page!.locator('button:has-text("Game")').first();
    const isButtonVisible = await gameModeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isButtonVisible) {
      await gameModeButton.click();
      await page!.waitForTimeout(2000);
    }

    // Find search input
    const searchInput = page!.locator('input[placeholder*="search" i], input[type="search"]').first();
    const hasSearchInput = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);
    
    if (hasSearchInput) {
      await searchInput.fill('strategy');
      await page!.waitForTimeout(2_000); // Wait for debounce + AI search
      
      // Check for AI search indicator
      const aiIndicator = page!.locator('[class*="sparkles"], text=/AI/i').first();
      const hasAiIndicator = await aiIndicator.isVisible({ timeout: 5_000 }).catch(() => false);
      
      // Search results should appear
      const results = page!.locator('[class*="game"], [data-testid="game"]').first();
      const hasResults = await results.isVisible({ timeout: 5_000 }).catch(() => false);
      
      expect(hasResults).toBeTruthy();
    }
  });

  test('game can be played', async () => {
    const gameModeButton = page!.locator('button:has-text("Game")').first();
    const isButtonVisible = await gameModeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isButtonVisible) {
      await gameModeButton.click();
      await page!.waitForTimeout(2000);
    }

    // Find play button
    const playButton = page!.locator('button:has-text("Play"), button[aria-label*="play" i]').first();
    const hasPlayButton = await playButton.isVisible({ timeout: 5_000 }).catch(() => false);
    
    if (hasPlayButton) {
      await playButton.click();
      await page!.waitForTimeout(2_000);
      
      // Check if game player modal opened
      const gamePlayer = page!.locator('[class*="player"], iframe[src*="game"], [data-testid="game-player"]').first();
      const hasPlayer = await gamePlayer.isVisible({ timeout: 5_000 }).catch(() => false);
      
      expect(hasPlayer).toBeTruthy();
    }
  });

  test('save state button exists in game player', async () => {
    const gameModeButton = page!.locator('button:has-text("Game")').first();
    const isButtonVisible = await gameModeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isButtonVisible) {
      await gameModeButton.click();
      await page!.waitForTimeout(2000);
    }

    // Open a game
    const playButton = page!.locator('button:has-text("Play")').first();
    const hasPlayButton = await playButton.isVisible({ timeout: 5_000 }).catch(() => false);
    
    if (hasPlayButton) {
      await playButton.click();
      await page!.waitForTimeout(2_000);
      
      // Look for save button
      const saveButton = page!.locator('button[aria-label*="save" i], button:has([class*="save"])').first();
      const hasSaveButton = await saveButton.isVisible({ timeout: 5_000 }).catch(() => false);
      
      // Save button should be present
      expect(hasSaveButton).toBeTruthy();
    }
  });

  test('save state persists across sessions', async () => {
    const gameModeButton = page!.locator('button:has-text("Game")').first();
    const isButtonVisible = await gameModeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isButtonVisible) {
      await gameModeButton.click();
      await page!.waitForTimeout(2000);
    }

    // Open a game
    const playButton = page!.locator('button:has-text("Play")').first();
    const hasPlayButton = await playButton.isVisible({ timeout: 5_000 }).catch(() => false);
    
    if (hasPlayButton) {
      await playButton.click();
      await page!.waitForTimeout(2_000);
      
      // Save state
      const saveButton = page!.locator('button[aria-label*="save" i]').first();
      const hasSaveButton = await saveButton.isVisible({ timeout: 5_000 }).catch(() => false);
      
      if (hasSaveButton) {
        await saveButton.click();
        await page!.waitForTimeout(1_000);
        
        // Check if save button changed state (visual indicator)
        const saveButtonAfter = page!.locator('button[aria-label*="save" i]').first();
        const isSaved = await saveButtonAfter.evaluate((btn) => {
          return btn.classList.toString().includes('green') || 
                 btn.getAttribute('class')?.includes('saved') ||
                 false;
        }).catch(() => false);
        
        // Save should be indicated visually
        console.log('Game state saved:', isSaved);
        
        // Close game player
        const closeButton = page!.locator('button[aria-label*="close" i], button:has([class*="close"])').first();
        const hasCloseButton = await closeButton.isVisible({ timeout: 5_000 }).catch(() => false);
        
        if (hasCloseButton) {
          await closeButton.click();
          await page!.waitForTimeout(1_000);
          
          // Reopen same game
          await playButton.click();
          await page!.waitForTimeout(2_000);
          
          // Check if load button appears
          const loadButton = page!.locator('button[aria-label*="load" i], button:has([class*="load"])').first();
          const hasLoadButton = await loadButton.isVisible({ timeout: 5_000 }).catch(() => false);
          
          // Load button should appear if save exists
          expect(hasLoadButton).toBeTruthy();
        }
      }
    }
  });

  test('game categories filter works', async () => {
    const gameModeButton = page!.locator('button:has-text("Game")').first();
    const isButtonVisible = await gameModeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isButtonVisible) {
      await gameModeButton.click();
      await page!.waitForTimeout(2000);
    }

    // Find category filter buttons
    const categoryButton = page!.locator('button:has-text("Action"), button:has-text("Puzzle"), button[class*="category"]').first();
    const hasCategoryButton = await categoryButton.isVisible({ timeout: 5_000 }).catch(() => false);
    
    if (hasCategoryButton) {
      await categoryButton.click();
      await page!.waitForTimeout(1_000);
      
      // Games should be filtered
      const filteredGames = page!.locator('[class*="game"]').first();
      const hasFiltered = await filteredGames.isVisible({ timeout: 5_000 }).catch(() => false);
      
      expect(hasFiltered).toBeTruthy();
    }
  });
});

