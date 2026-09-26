import { test, expect, beforeAll, afterAll } from 'bun:test';
import { startApp, stopApp, cleanupApp, type AppInstance } from './electron-test-utils';

let appInstance: AppInstance | null = null;

beforeAll(async () => {
  appInstance = await startApp();
  // Ensure we start fresh
  await appInstance.page.waitForTimeout(1000);
});

afterAll(async () => {
  if (appInstance) {
    await stopApp(appInstance.app);
  } else {
    await cleanupApp();
  }
});

test('Complete Template Flow: Create, View, Delete', async () => {
  const { page } = appInstance!;
  const testTemplateName = `E2E-Template-${Date.now()}`;

  // 1. Navigate to Templates
  const settingsLink = page.locator('nav a', { hasText: 'Templates' });
  await settingsLink.waitFor({ state: 'visible', timeout: 5000 });
  await settingsLink.click();

  // 2. Wait for page load
  const h1 = page.locator('h1', { hasText: 'Templates' });
  await h1.waitFor({ state: 'visible', timeout: 5000 });

  // 3. Open Create Modal
  const createBtn = page.locator('button', { hasText: '+ New Template' });
  await createBtn.click();

  // 4. Fill form
  const nameInput = page.locator('input[placeholder="e.g., JacksonLab News"]');
  await nameInput.waitFor({ state: 'visible' });
  await nameInput.fill(testTemplateName);

  // 5. Submit
  const submitBtn = page.locator('button', { hasText: 'Create' }).first();
  await submitBtn.click();

  // 6. Verify creation
  // The UI should update to show the new template card
  const newTemplateCard = page.locator(`h3:has-text("${testTemplateName}")`);
  await newTemplateCard.waitFor({ state: 'visible', timeout: 10000 });
  const isVisible = await newTemplateCard.isVisible();
  expect(isVisible).toBe(true);

  // 7. Click Delete
  // Find the trash button within the same card
  const cardContainer = newTemplateCard.locator('..').locator('..'); 
  const trashBtn = cardContainer.locator('button').first();
  
  // Hover over the card to reveal the trash button if it relies on CSS hover
  await cardContainer.hover();
  await trashBtn.click();

  // 8. Confirm Delete Dialog
  const confirmBtn = page.locator('button', { hasText: 'Delete' }).last();
  await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
  await confirmBtn.click();

  // 9. Verify Deletion
  // The template should no longer be visible
  await newTemplateCard.waitFor({ state: 'hidden', timeout: 10000 });
  const isGone = !(await newTemplateCard.isVisible());
  expect(isGone).toBe(true);

}, 30000);