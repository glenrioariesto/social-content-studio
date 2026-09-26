import { test, expect, beforeAll, afterAll } from 'bun:test';
import { startApp, stopApp, cleanupApp, type AppInstance } from './electron-test-utils';

let appInstance: AppInstance | null = null;

beforeAll(async () => {
  // Launch the application before tests
  appInstance = await startApp();
});

afterAll(async () => {
  // Clean up
  if (appInstance) {
    await stopApp(appInstance.app);
  } else {
    await cleanupApp();
  }
});

test('App should launch and navigate to Settings', async () => {
  expect(appInstance).not.toBeNull();
  const { page } = appInstance!;

  // Verify the app opened successfully by checking a known title or element
  const titleLocator = page.locator('text=Social Studio').first();
  await titleLocator.waitFor({ state: 'visible', timeout: 10000 });
  const titleVisible = await titleLocator.isVisible();
  expect(titleVisible).toBe(true);

  // Click on "Settings" in the sidebar
  const settingsLink = page.locator('nav a', { hasText: 'Settings' });
  await settingsLink.waitFor({ state: 'visible', timeout: 5000 });
  await settingsLink.click();
  // Verify we are on the Settings page
  const settingsHeader = page.locator('h1', { hasText: 'Settings' });
    await settingsHeader.waitFor({ state: 'visible', timeout: 5000 });
  const settingsVisible = await settingsHeader.isVisible();
  expect(settingsVisible).toBe(true);
}, 15000);
test('Should test AI connection and show a toast', async () => {
  const { page } = appInstance!;

  // Locate the "Test Connection" button
  const testButton = page.locator('button', { hasText: 'Test Connection' });
  await testButton.waitFor({ state: 'visible', timeout: 5000 });
  await testButton.click();

  // Wait for the button text to change to "Testing..." or for a toast to appear
  // The toast could be success, error, or info based on settings. We just check if ANY toast appears.
  const toastContainer = page.locator('.fixed.bottom-4.right-4');
  
  // Wait for at least one toast message to appear inside the container
  const toastMessage = toastContainer.locator('div > span').first();

    // Wait for it to attach/be visible manually since we don't have Playwright expect
    await toastMessage.waitFor({ state: 'visible', timeout: 30000 });
  
  const isVisible = await toastMessage.isVisible();
  expect(isVisible).toBe(true);
  
  // Optional: Read what the toast says
  const text = await toastMessage.textContent();
  expect(text).not.toBeNull();
}, 45000);
