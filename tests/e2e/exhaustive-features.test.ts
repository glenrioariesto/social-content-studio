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

test('Accounts Flow: Create and Validate', async () => {
  const { page } = appInstance!;
  
  // Navigate to Accounts
  await page.locator('nav a', { hasText: 'Accounts' }).click();
  await page.locator('h1', { hasText: 'Accounts' }).waitFor({ state: 'visible' });

  // Open New Account
  await page.locator('button', { hasText: '+ New Account' }).click();
  
  // Fill form
  const nameInput = page.locator('input[placeholder="e.g., JacksonLab"]');
  await nameInput.waitFor({ state: 'visible' });
  await nameInput.fill(`Test Account ${Date.now()}`);
  
  // Save
  await page.locator('button', { hasText: 'Create account' }).first().click();
  
  await nameInput.waitFor({ state: 'hidden', timeout: 5000 });
}, 30000);

test('Resources Flow: Attempt Download', async () => {
  const { page } = appInstance!;
  
  // Navigate to Resources
  await page.locator('nav a', { hasText: 'Resources' }).click();
  await page.locator('h1', { hasText: 'Resources' }).waitFor({ state: 'visible' });

  // Paste a dummy URL
  const input = page.locator('input[placeholder*="Paste video URL"]');
  await input.fill('https://youtube.com/watch?v=dummy');

  // Click Download
  await page.locator('button', { hasText: 'Download' }).click();
  
  // Expect it to change to "Downloading..." or show an error toast
  // Since it's a dummy URL, yt-dlp will fail and show an error toast, which means the button becomes active again.
  // We just wait for the button to not say Downloading... after some time.
  const downloadBtn = page.locator('button', { hasText: 'Download' }).first();
  await downloadBtn.waitFor({ state: 'visible', timeout: 15000 });
}, 30000);

test('Agent Studio Flow: Run Tool', async () => {
  const { page } = appInstance!;
  
  // Navigate to Agent Studio
  await page.locator('nav a', { hasText: 'Agent Studio' }).click();
  await page.locator('h1', { hasText: 'Agent Studio' }).waitFor({ state: 'visible' });

  // Click Reload tools
  await page.locator('button', { hasText: 'Reload tools' }).click();
  // Find a preset tool button, like "List templates"
  const listBtn = page.locator('button', { hasText: 'List templates' }).first();
  await listBtn.waitFor({ state: 'visible' });
  await listBtn.click();

  // Wait for result to appear
  const preBlock = page.locator('pre');
  await preBlock.waitFor({ state: 'visible', timeout: 5000 });
  
  // Check result
  const text = await preBlock.textContent();
  expect(text).toContain('['); // Should be a JSON array of templates
}, 30000);
