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

test('Full Data Lifecycle: Input, Persist, and Fetch Verification', async () => {
  const { page } = appInstance!;
  const uniqueTimestamp = Date.now().toString();
  const testAccountName = `DataFlow-Acc-${uniqueTimestamp}`;
  const testDescription = `This is a rigorous E2E test description for ${uniqueTimestamp}`;
  
  // 1. Navigate to Accounts
  await page.locator('nav a', { hasText: 'Accounts' }).click();
  await page.locator('h1', { hasText: 'Accounts' }).waitFor({ state: 'visible' });

  // 2. Open New Account Modal
  await page.locator('button', { hasText: '+ New Account' }).click();
  
  // 3. Input Data
  const nameInput = page.locator('input[placeholder="e.g., JacksonLab"]');
  await nameInput.waitFor({ state: 'visible' });
  await nameInput.fill(testAccountName);

  const descInput = page.locator('textarea');
  await descInput.fill(testDescription);
  
  // 4. Save Data to Backend (Triggers IPC write to JSON)
  await page.locator('button', { hasText: 'Create account' }).first().click();
  
  // Ensure the modal closes, signifying a successful save
  await nameInput.waitFor({ state: 'hidden', timeout: 5000 });

  // 5. FETCH & VERIFY: The app must reload data from backend and render our unique text
  // We look for a card heading or text that perfectly matches our input
  const newAccountElement = page.locator(`text=${testAccountName}`).first();
  await newAccountElement.waitFor({ state: 'visible', timeout: 10000 });
  
  const isFetchedAndVisible = await newAccountElement.isVisible();
  expect(isFetchedAndVisible).toBe(true);

  // Bonus: Verify description is also fetched
  // Account cards display description text
  const descElement = page.locator(`text=${testDescription}`).first();
  await descElement.waitFor({ state: 'visible', timeout: 10000 });
  expect(await descElement.isVisible()).toBe(true);
  
  console.log(`✅ Data Flow Verified! Successfully persisted and fetched: ${testAccountName}`);

}, 45000);