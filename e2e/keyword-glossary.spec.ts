// AI-Assisted: Claude Code (model: Claude Sonnet 5) - The keyword tooltip's behaviour test
// (005-rules-web-enrichment-display task T020; spec.md FR-010, FR-011, FR-013, SC-007;
// contracts/render-contract.md section 3), written after KeywordTag.astro and its hover script.
//
// AI-Assisted note (model: Claude Sonnet 5, cursor-hover-keyword-tooltip branch): rewrote the
// "Covered keyword tooltip" block for the cursor-anchored floating preview - hover no longer opens
// the <details> in place, so "opens on hover" is no longer a true statement to test. Click,
// keyboard, touch, and the no-JS block are UNCHANGED, because none of those triggers moved; only
// what a pointing-device hover does changed.
//
// Runs against `astro preview` serving a build of the ENRICHED fixture (playwright.config.ts), so
// "Battleline" resolves via the glossary while "Infantry" on the same page does not - real
// fixture data, not invented per-test content.
//
// Native <details>/<summary> is why click and keyboard need no script at all (research.md section
// 2): the "with JavaScript disabled" describe block below is the direct proof that SC-007 holds
// even if the enhancement script never loads, exercising the exact posture research.md documents
// rather than merely asserting it in prose.
import { expect, test } from '@playwright/test';

// Playwright's test runner loads this file through Node's native ESM loader (not Vite, unlike the
// Vitest side of this repo), which requires the explicit `type: 'json'` import attribute below.
import bundle from '../test/fixtures/bundle-synth-enriched.json' with { type: 'json' };

const BRAMBLE_WARDEN = '/factions/verdant-concord/units/bramble-warden/';

const BATTLELINE_SUMMARY = bundle.keywordGlossary.find((g) => g.keywordKey === 'battleline')!.summary;

test.describe('Covered keyword tooltip (JavaScript enabled)', () => {
  test('shows a cursor-anchored floating preview on hover, without opening the details', async ({
    page,
  }) => {
    await page.goto(BRAMBLE_WARDEN);
    const details = page.locator('[data-keyword-glossary="battleline"]');
    const summary = details.locator('summary');
    const tip = page.locator('.keyword-float-tip');

    await expect(tip).toBeHidden();

    // `.hover()` scrolls the target into view before moving the pointer, which a raw
    // `page.mouse.move()` to a not-yet-visible element's (viewport-relative) coordinates does not.
    await summary.hover();
    const summaryBox = (await summary.boundingBox())!;
    const cursorX = summaryBox.x + summaryBox.width / 2;
    const cursorY = summaryBox.y + summaryBox.height / 2;

    // The hover trigger no longer opens the disclosure - that is the whole point of this change.
    await expect(details).not.toHaveAttribute('open', '');
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText(BATTLELINE_SUMMARY);

    // Anchored near the cursor: below-right of it, within the ~14px offset plus a small margin
    // for the box's own border/padding - not pinned to a fixed corner of the page.
    const tipBox = (await tip.boundingBox())!;
    expect(tipBox.x).toBeGreaterThan(cursorX);
    expect(tipBox.x).toBeLessThan(cursorX + 60);
    expect(tipBox.y).toBeGreaterThan(cursorY);
    expect(tipBox.y).toBeLessThan(cursorY + 60);

    // Moving the pointer well away hides it again.
    await page.locator('h1').hover();
    await expect(tip).toBeHidden();
  });

  test('follows the cursor while it moves across the summary', async ({ page }) => {
    await page.goto(BRAMBLE_WARDEN);
    const summary = page.locator('[data-keyword-glossary="battleline"] summary');
    const tip = page.locator('.keyword-float-tip');

    await summary.scrollIntoViewIfNeeded();
    const summaryBox = (await summary.boundingBox())!;

    await page.mouse.move(summaryBox.x + 2, summaryBox.y + 2);
    await expect(tip).toBeVisible();
    const firstPosition = (await tip.boundingBox())!;

    await page.mouse.move(summaryBox.x + summaryBox.width - 2, summaryBox.y + summaryBox.height - 2);
    const secondPosition = (await tip.boundingBox())!;

    expect(secondPosition.x).not.toBe(firstPosition.x);
  });

  test('flips above the cursor instead of overflowing the bottom of a small viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 480, height: 320 });
    await page.goto(BRAMBLE_WARDEN);
    const summary = page.locator('[data-keyword-glossary="battleline"] summary');
    const tip = page.locator('.keyword-float-tip');

    // Push the keyword flush against the bottom of the (small) viewport, so a naive below-cursor
    // placement would run off the bottom edge and the flip-above rule has something to prove.
    await summary.evaluate((element) => element.scrollIntoView({ block: 'end' }));
    const summaryBox = (await summary.boundingBox())!;
    const cursorX = summaryBox.x + summaryBox.width / 2;
    const cursorY = summaryBox.y + summaryBox.height / 2;

    await page.mouse.move(cursorX, cursorY);
    await expect(tip).toBeVisible();

    const tipBox = (await tip.boundingBox())!;
    expect(tipBox.y).toBeLessThan(cursorY);
    expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(320);
  });

  test('toggles open and closed on click, independent of hover', async ({ page }) => {
    await page.goto(BRAMBLE_WARDEN);
    const details = page.locator('[data-keyword-glossary="battleline"]');
    const summary = details.locator('summary');

    await summary.click();
    await expect(details).toHaveAttribute('open', '');

    await summary.click();
    await expect(details).not.toHaveAttribute('open', '');
  });

  test('opens via keyboard (Tab then Enter) and closes on Escape', async ({ page }) => {
    await page.goto(BRAMBLE_WARDEN);
    const details = page.locator('[data-keyword-glossary="battleline"]');
    const summary = details.locator('summary');
    const tip = page.locator('.keyword-float-tip');

    await summary.focus();
    await expect(summary).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    // Keyboard focus never triggers the floating preview - only a pointing-device hover does.
    await expect(tip).toBeHidden();

    await page.keyboard.press('Escape');
    await expect(details).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
  });
});

test.describe('An already-open (pinned) details suppresses the floating preview', () => {
  test('does not show the floating preview on hover once opened by click', async ({ page }) => {
    await page.goto(BRAMBLE_WARDEN);
    const details = page.locator('[data-keyword-glossary="battleline"]');
    const summary = details.locator('summary');
    const tip = page.locator('.keyword-float-tip');

    await summary.click();
    await expect(details).toHaveAttribute('open', '');

    await summary.hover();
    await expect(tip).toBeHidden();
  });

  test('hides the floating preview immediately if opened by click while still hovered', async ({
    page,
  }) => {
    await page.goto(BRAMBLE_WARDEN);
    const details = page.locator('[data-keyword-glossary="battleline"]');
    const summary = details.locator('summary');
    const tip = page.locator('.keyword-float-tip');

    await summary.hover();
    await expect(tip).toBeVisible();

    await summary.click();
    await expect(details).toHaveAttribute('open', '');
    await expect(tip).toBeHidden();
  });
});

test.describe('Touch (tap-to-toggle)', () => {
  test.use({ hasTouch: true });

  test('opens on the first tap and closes on the second', async ({ page }) => {
    await page.goto(BRAMBLE_WARDEN);
    const details = page.locator('[data-keyword-glossary="battleline"]');
    const summary = details.locator('summary');

    await summary.tap();
    await expect(details).toHaveAttribute('open', '');

    await summary.tap();
    await expect(details).not.toHaveAttribute('open', '');
  });
});

test.describe('Uncovered keyword (no affordance)', () => {
  test('renders as a plain tag, with no details element and no glossary attribute', async ({ page }) => {
    await page.goto(BRAMBLE_WARDEN);

    const infantryTag = page.locator('li[data-keyword]', { hasText: 'Infantry' });
    await expect(infantryTag).toBeVisible();
    await expect(infantryTag.locator('details')).toHaveCount(0);
    await expect(page.locator('[data-keyword-glossary="infantry"]')).toHaveCount(0);
  });

  test('shows no floating preview on hover', async ({ page }) => {
    await page.goto(BRAMBLE_WARDEN);
    const infantryTag = page.locator('li[data-keyword]', { hasText: 'Infantry' });

    await infantryTag.hover();
    await expect(page.locator('.keyword-float-tip')).toBeHidden();
  });
});

test.describe('With JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('the covered keyword still opens via keyboard, with zero pointer interaction (SC-007)', async ({
    page,
  }) => {
    await page.goto(BRAMBLE_WARDEN);
    const details = page.locator('[data-keyword-glossary="battleline"]');
    const summary = details.locator('summary');

    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');

    // The enhancement script never loaded, so a second Enter (native toggle) - not a mouse action
    // - is what closes it; this is the documented, accepted degradation (research.md section 2).
    await page.keyboard.press('Enter');
    await expect(details).not.toHaveAttribute('open', '');
  });

  test('a click still toggles the native disclosure with no script running', async ({ page }) => {
    await page.goto(BRAMBLE_WARDEN);
    const details = page.locator('[data-keyword-glossary="battleline"]');

    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
  });
});
