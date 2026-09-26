import { test, expect, beforeAll, afterAll } from 'bun:test';
import { startApp, stopApp, cleanupApp, type AppInstance } from './electron-test-utils';

let appInstance: AppInstance | null = null;

beforeAll(async () => {
  appInstance = await startApp();
  // Wait for initial render
  await appInstance.page.waitForTimeout(1000);
});

afterAll(async () => {
  if (appInstance) {
    await stopApp(appInstance.app);
  } else {
    await cleanupApp();
  }
});

const pagesToTest = [
  { label: 'Dashboard', heading: 'Dashboard' },
  { label: 'All Content', heading: 'Content Library' }, // Assuming heading is something like Content
  { label: 'Templates', heading: 'Templates' },
  { label: 'Assets', heading: 'Assets' },
  { label: 'Resources', heading: 'Resources' },
  { label: 'Render Queue', heading: 'Render Queue' },
  { label: 'Batch Render', heading: 'Batch Render' },
  { label: 'Agent Studio', heading: 'Agent Studio' },
  { label: 'Calendar', heading: 'Calendar' },
  { label: 'Accounts', heading: 'Accounts' },
  { label: 'Logs', heading: 'System Logs' }, // Guessing heading text
  { label: 'Settings', heading: 'Settings' }
];

test('Sweep: All pages should load without crashing', async () => {
  expect(appInstance).not.toBeNull();
  const { page } = appInstance!;

  // First verify the sidebar is visible
  const sidebarTitle = page.locator('text=Social Studio').first();
  await sidebarTitle.waitFor({ state: 'visible', timeout: 10000 });
  expect(await sidebarTitle.isVisible()).toBe(true);

  for (const p of pagesToTest) {
    console.log(`Testing page: ${p.label}`);
    const navLink = page.locator('nav a', { hasText: p.label });
    await navLink.waitFor({ state: 'visible', timeout: 5000 });
    await navLink.click();

    // Wait a moment for page transition and render
    await page.waitForTimeout(500);

    // Look for an h1 tag. We won't strictly enforce the exact text right away, 
    // we'll just check if an h1 exists and log what it is.
    // This is because some pages might not have the exact heading we guessed.
    const h1 = page.locator('h1').first();
    try {
      await h1.waitFor({ state: 'visible', timeout: 5000 });
      const text = await h1.textContent();
      console.log(`✅ Loaded ${p.label}, Found heading: ${text}`);
      expect(text).toBeTruthy();
    } catch (e) {
      // If it fails, maybe there's no h1 or the page crashed.
      console.error(`❌ FAILED on ${p.label} page. Could not find h1.`);
      const html = await page.innerHTML('body');
      console.error(`HTML Dump for ${p.label}:`, html.substring(0, 1000) + '...');
      throw e;
    }
  }
}, 60000); // 60 seconds for the whole sweep
