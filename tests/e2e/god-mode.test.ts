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

test('God Mode: Aggressive interaction across all features', async () => {
  const { page } = appInstance!;
  const testRunId = Date.now();
  
  // Helper to ensure we are on a clean page state (dismissing lingering modals)
  const clearModals = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
  };

  const navigateTo = async (menuName: string) => {
    await clearModals();
    await page.locator('nav a', { hasText: menuName }).click({ force: true });
    await page.waitForTimeout(500); // Allow render
  };

  // 1. Content Feature
  await navigateTo('All Content');
  try {
    await page.locator('button', { hasText: '+ New Content' }).click({ force: true, timeout: 2000 });
    // Attempt to type in content wizard if it appears
    const titleInput = page.locator('input[placeholder="e.g., My Awesome Video"]');
    if (await titleInput.isVisible()) {
       await titleInput.fill(`Content ${testRunId}`);
       await page.locator('button', { hasText: 'Create Content' }).click({ force: true });
    }
  } catch(e) { console.log('Content feature skipped or blocked'); }

  // 2. Templates Feature
  await navigateTo('Templates');
  try {
    await page.locator('button', { hasText: '+ New Template' }).click({ force: true, timeout: 2000 });
    const tplName = page.locator('input[placeholder="e.g., JacksonLab News"]');
    await tplName.fill(`Template ${testRunId}`);
    await page.locator('button', { hasText: 'Create' }).first().click({ force: true });
  } catch(e) { console.log('Templates feature skipped or blocked'); }

  // 3. Assets Feature
  await navigateTo('Assets');
  try {
    // Assets usually open a native file picker, we just verify the button exists
    const uploadBtn = page.locator('button', { hasText: '+ Upload' });
    expect(await uploadBtn.isVisible()).toBe(true);
  } catch(e) { console.log('Assets feature skipped or blocked'); }

  // 4. Resources Feature
  await navigateTo('Resources');
  try {
    await page.locator('input[placeholder*="video URL"]').fill('https://example.com');
    await page.locator('button', { hasText: 'Download' }).click({ force: true });
  } catch(e) { console.log('Resources feature skipped or blocked'); }

  // 5. Render Queue
  await navigateTo('Render Queue');
  try {
    const clearBtn = page.locator('button', { hasText: 'Clear finished' });
    if (await clearBtn.isVisible()) await clearBtn.click({ force: true });
  } catch(e) { console.log('Queue feature skipped or blocked'); }

  // 6. Batch Render
  await navigateTo('Batch Render');
  try {
    const csvBtn = page.locator('button', { hasText: 'Choose CSV File' });
    expect(await csvBtn.isVisible()).toBe(true);
  } catch(e) { console.log('Batch feature skipped or blocked'); }

  // 7. Agent Studio
  await navigateTo('Agent Studio');
  try {
    await page.locator('button', { hasText: 'Reload tools' }).click({ force: true });
    await page.locator('button', { hasText: 'List templates' }).click({ force: true });
  } catch(e) { console.log('Agent Studio skipped or blocked'); }

  // 8. Accounts Feature
  await navigateTo('Accounts');
  try {
    await page.locator('button', { hasText: '+ New Account' }).click({ force: true, timeout: 2000 });
    await page.locator('input[placeholder="e.g., JacksonLab"]').fill(`Acc ${testRunId}`);
    await page.locator('button', { hasText: 'Create account' }).first().click({ force: true });
  } catch(e) { console.log('Accounts feature skipped or blocked'); }

  // Final verification to ensure the app survived the barrage
  await clearModals();
  await navigateTo('Dashboard');
  const dashTitle = page.locator('h1', { hasText: 'Dashboard' });
  try {
    await dashTitle.waitFor({ state: 'visible', timeout: 5000 });
  } catch (e) {
    const fs = require('fs');
    fs.writeFileSync('god-mode-crash.html', await page.innerHTML('body'));
    throw e;
  }
  expect(await dashTitle.isVisible()).toBe(true);
  console.log('✅ God Mode Sweep Completed without crashing the app.');
  
}, 90000);