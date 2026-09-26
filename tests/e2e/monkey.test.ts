import { test, expect, beforeAll, afterAll } from 'bun:test';
import { startApp, stopApp, cleanupApp, type AppInstance } from './electron-test-utils';

let appInstance: AppInstance | null = null;

beforeAll(async () => {
  appInstance = await startApp();
  await appInstance.page.waitForTimeout(1000);
});

afterAll(async () => {
  if (appInstance) {
    await stopApp(appInstance.app);
  } else {
    await cleanupApp();
  }
});

test('Chaos Monkey: Click multiple buttons across all pages', async () => {
  const { page } = appInstance!;
  
  // Verify app launched
  const sidebarTitle = page.locator('text=Social Studio').first();
  await sidebarTitle.waitFor({ state: 'visible', timeout: 10000 });
  
  // Get all navigation links in the sidebar
  const navLinksCount = await page.locator('nav a').count();
  
  // Iterate through all pages
  for (let i = 0; i < navLinksCount; i++) {
    const navLink = page.locator('nav a').nth(i);
    await navLink.click();
    await page.waitForTimeout(500); // Allow page to render
    
    const pageUrl = await page.url();
    console.log(`[Monkey] Crawling page: ${pageUrl}`);
    // Find all buttons on the current page's main content area (ignore window close buttons)
    const buttons = page.locator('main button');
    const buttonCount = await buttons.count();
    
    // Click up to 5 buttons on this page to test interactivity
    // (We limit it to avoid getting stuck in infinite loops or deleting everything)
    const clicksToPerform = Math.min(buttonCount, 5);
    
    for (let j = 0; j < clicksToPerform; j++) {
      const btn = buttons.nth(j);
      
      try {
        if (await btn.isVisible() && await btn.isEnabled()) {
          const btnText = await btn.textContent() || 'Icon Button';
          console.log(`  -> Clicking button: ${btnText.trim()}`);
          
          // Click without waiting for navigation, just trigger the action
          await btn.click({ timeout: 1000, noWaitAfter: true });
          await page.waitForTimeout(200);
          
          // If the button opened a modal (like Delete confirmation or Create form), 
          // we attempt to dismiss it so the crawler can continue.
          await page.keyboard.press('Escape');
          await page.waitForTimeout(100);
        }
      } catch (e) {
        // Ignore buttons that became detached or unclickable
      }
    }
  }
  
  // Final verification: The app should still be alive and not crashed into a white screen
  const isStillAlive = await sidebarTitle.isVisible();
  expect(isStillAlive).toBe(true);
  
}, 60000);