// AI-Assisted: Claude Code (model: Claude Sonnet 5) - The keyword tooltip's behaviour test
// (005-rules-web-enrichment-display task T020; spec.md FR-010, FR-011, FR-013, SC-007;
// contracts/render-contract.md section 3), written after KeywordTag.astro and its hover script.
//
// Runs against `astro preview` serving a build of the ENRICHED fixture (playwright.config.ts), so
// "Battleline" resolves via the glossary while "Infantry" on the same page does not - real
// fixture data, not invented per-test content.
//
// Native <details>/<summary> is why click and keyboard need no script at all (research.md section
// 2): the "with JavaScript disabled" describe block below is the direct proof that SC-007 holds
// even if the hover-enhancement script never loads, exercising the exact posture research.md
// documents rather than merely asserting it in prose.
import { expect, test } from '@playwright/test';

const BRAMBLE_WARDEN = '/factions/verdant-concord/units/bramble-warden/';

test.describe('Covered keyword tooltip (JavaScript enabled)', () => {
  test('opens on hover after the debounce, and closes when the pointer leaves', async ({ page }) => {
    await page.goto(BRAMBLE_WARDEN);
    const details = page.locator('[data-keyword-glossary="battleline"]');
    const description = details.locator('p.keyword-glossary__summary');

    await expect(details).not.toHaveAttribute('open', '');
    await expect(description).toBeHidden();

    await details.locator('summary').hover();
    await expect(details).toHaveAttribute('open', '');
    await expect(description).toBeVisible();

    // Move the pointer well away from the tooltip so mouseleave actually fires.
    await page.locator('h1').hover();
    await expect(details).not.toHaveAttribute('open', '');
  });

  test('toggles open and closed on click, independent of the hover script', async ({ page }) => {
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

    await summary.focus();
    await expect(summary).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');

    await page.keyboard.press('Escape');
    await expect(details).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
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

    // The hover script never loaded, so a second Enter (native toggle) - not a mouse action - is
    // what closes it; this is the documented, accepted degradation (research.md section 2).
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
