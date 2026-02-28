import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const STORE_PATH = path.join(__dirname, '../../.ng-annotate/store.json');

interface StoreAnnotation {
  status: string;
  annotationText: string;
}

interface StoreData {
  sessions: Record<string, unknown>;
  annotations: Record<string, StoreAnnotation>;
}

function readStore(): StoreData {
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  return JSON.parse(raw) as StoreData;
}

function deleteStore(): void {
  if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
}

test.beforeEach(() => {
  deleteStore();
});

test.afterEach(() => {
  deleteStore();
});

test('manifest is injected into page', async ({ page }) => {
  await page.goto('/');

  const manifest = await page.evaluate(
    () => (window as unknown as Record<string, unknown>).__NG_ANNOTATE_MANIFEST__,
  );

  expect(manifest).toBeDefined();
  const m = manifest as Record<string, { component: string; template?: string }>;
  expect(m['SimpleCard']).toBeDefined();
  expect(m['StatsPanel']).toBeDefined();
  expect(m['StatsPanel'].template).toBeDefined();
});

test('overlay activates on Alt+Shift+A', async ({ page }) => {
  await page.goto('/');

  const hint = page.locator('.nga-keyboard-hint');

  // Initially in hidden mode — hint prompts to press the shortcut
  await expect(hint).toContainText('Alt+Shift+A');

  // Activate inspect mode
  await page.keyboard.press('Alt+Shift+A');

  // Now in inspect mode — hint prompts to click or press Esc
  await expect(hint).toContainText('Esc');
});

test('hovering a component shows the highlight rect', async ({ page }) => {
  await page.goto('/');

  // Enter inspect mode
  await page.keyboard.press('Alt+Shift+A');

  // Hover over the simple-card element
  await page.hover('app-simple-card');

  // Highlight rect should appear in the DOM
  await expect(page.locator('.nga-highlight-rect')).toBeVisible();
});

test('clicking a component opens annotate panel', async ({ page }) => {
  await page.goto('/');

  // Enter inspect mode
  await page.keyboard.press('Alt+Shift+A');

  // Click simple-card — preventDefault/stopPropagation are called inside the component
  await page.click('app-simple-card');

  // Annotate panel should be visible and show the component name
  const panel = page.locator('.nga-annotate-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('SimpleCard');
});

test('submitting an annotation creates a store entry', async ({ page }) => {
  await page.goto('/');

  // Enter inspect mode and click component
  await page.keyboard.press('Alt+Shift+A');
  await page.click('app-simple-card');

  // Fill in annotation text and submit
  await page.fill('.nga-textarea', 'Playwright test annotation');
  await page.click('.nga-btn-submit');

  // Wait for the WebSocket round-trip to persist the annotation to disk
  await expect
    .poll(
      () => {
        try {
          const data = readStore();
          return Object.values(data.annotations).length;
        } catch {
          return 0;
        }
      },
      { timeout: 5000 },
    )
    .toBeGreaterThan(0);

  const data = readStore();
  const annotations = Object.values(data.annotations);
  expect(annotations).toHaveLength(1);
  expect(annotations[0].status).toBe('pending');
  expect(annotations[0].annotationText).toBe('Playwright test annotation');
});

test('badge appears after annotation is created', async ({ page }) => {
  await page.goto('/');

  // Enter inspect mode and click component
  await page.keyboard.press('Alt+Shift+A');
  await page.click('app-simple-card');

  // Fill in annotation text and submit
  await page.fill('.nga-textarea', 'Playwright test annotation');
  await page.click('.nga-btn-submit');

  // Badge should appear once the annotation is broadcast back via WebSocket
  await expect(page.locator('.nga-badge')).toBeVisible({ timeout: 5000 });
});
