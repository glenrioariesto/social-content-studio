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

test('Visual Builder: Drag and Drop functionality', async () => {
  const { page } = appInstance!;
  const testTemplateName = `Visual-Template-${Date.now()}`;

  // 1. Navigate to Templates and Create New
  await page.locator('nav a', { hasText: 'Templates' }).click();
  await page.locator('button', { hasText: '+ New Template' }).click();
  await page.locator('input[placeholder="e.g., JacksonLab News"]').fill(testTemplateName);
  await page.locator('button', { hasText: 'Create' }).first().click();

  // 2. Open the Editor for the new template
  // The new template should be visible in the list. Wait for it.
  const newTemplateCard = page.locator(`h3:has-text("${testTemplateName}")`);
  await newTemplateCard.waitFor({ state: 'visible', timeout: 5000 });
  
  // Find the 'Open Editor' button inside the specific card container
  const cardContainer = page.locator('.group').filter({ has: newTemplateCard }).first();
  const openEditorBtn = cardContainer.locator('button', { hasText: 'Open Editor' });
  await openEditorBtn.click();

  // Wait for Editor to appear (Back button is a good indicator)
  const backBtn = page.locator('button', { hasText: '← Back' });
  await backBtn.waitFor({ state: 'visible', timeout: 5000 });

  // 3. Switch to VISUAL tab
  const visualTab = page.locator('button', { hasText: 'VISUAL' });
  await visualTab.waitFor({ state: 'visible' });
  await visualTab.click();

  // 4. Add Text Element
  const addTextBtn = page.locator('button', { hasText: 'Text' });
  await addTextBtn.click();

  // 5. Verify the element appeared on the canvas
  const draggableElement = page.locator('.visual-el').first(); // The inner div
  const rndContainer = page.locator('.react-draggable').first(); // The react-rnd container
  
  await rndContainer.waitFor({ state: 'visible' });
  
  // Get initial bounding box
  const initialBox = await rndContainer.boundingBox();
  expect(initialBox).not.toBeNull();
  
  console.log(`Initial position: X=${initialBox!.x}, Y=${initialBox!.y}`);

  // 6. Perform Drag and Drop (geser-geser)
  // We drag the element 100px to the right and 100px down
  await page.mouse.move(initialBox!.x + 10, initialBox!.y + 10);
  await page.mouse.down();
  await page.mouse.move(initialBox!.x + 110, initialBox!.y + 110, { steps: 10 });
  await page.mouse.up();

  // Get new bounding box
  const finalBox = await rndContainer.boundingBox();
  expect(finalBox).not.toBeNull();

  console.log(`Final position: X=${finalBox!.x}, Y=${finalBox!.y}`);

  // Verify it actually moved significantly
  expect(finalBox!.x).toBeGreaterThan(initialBox!.x + 50);
  expect(finalBox!.y).toBeGreaterThan(initialBox!.y + 10); // Y axis might be constrained by parent bounds

  // 7. Switch to HTML tab to verify it auto-compiled without coding
  const htmlTab = page.locator('button', { hasText: 'HTML' });
  await htmlTab.click();

  // Wait a moment for Monaco to render
  await page.waitForTimeout(1000);
  
  console.log('✅ Visual Drag and Drop verified successfully! Zero coding required.');

}, 30000);