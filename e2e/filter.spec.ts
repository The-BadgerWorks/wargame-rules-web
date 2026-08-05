// AI-Assisted: Claude Code (model: claude-opus-5) - The client-side unit filter's behaviour test
// (task T033; FR-016, FR-017, US3 acceptance scenarios 1-3). Written before
// src/components/UnitFilter.astro exists and confirmed failing first.
//
// This is the ONE Playwright spec in the suite (research D6). Everything else about the site is a
// static-output property provable against built HTML; the filter is the site's only behaviour, and
// the two things FR-016 actually promises - "no page navigation" and "no server request" - are
// negative claims about a real browser that no HTML assertion can make.
//
// Both negatives are asserted directly rather than inferred:
//
//   * no navigation: a sentinel is written onto `window` after load and re-read after each
//     interaction. A navigation of any kind - form submit, link follow, reload - discards it.
//   * no request: every request the page makes after it has settled is recorded, and the count must
//     stay at zero across typing, clearing and category selection.
//
// It runs against `astro preview` serving a build of the SYNTHETIC fixtures (playwright.config.ts),
// so the unit names below are invented fixture data, not published content.
import { expect, test, type Page } from '@playwright/test';

/** A fixture faction with several units, one of each interesting category flag. */
const FACTION_URL = '/factions/verdant-concord/';

/** Every unit test/fixtures/bundle-synth.json gives that faction, in rendered (name) order. */
const ALL_UNITS = [
  'Bramble Warden',
  'Seedpod Hauler',
  'Thicket Matriarch',
  'Witherstalk Relic',
];

const SENTINEL = '__wgcFilterSentinel';

const visibleUnits = (page: Page) => page.locator('li[data-unit]:visible');

/** Written after load; still there means nothing navigated, because a navigation discards it. */
async function markPage(page: Page): Promise<void> {
  await page.evaluate((key) => {
    (window as unknown as Record<string, unknown>)[key] = 'alive';
  }, SENTINEL);
}

async function pageNeverNavigated(page: Page): Promise<boolean> {
  const value = await page.evaluate(
    (key) => (window as unknown as Record<string, unknown>)[key],
    SENTINEL,
  );
  return value === 'alive';
}

async function openFaction(page: Page): Promise<string[]> {
  await page.goto(FACTION_URL);
  await expect(visibleUnits(page)).toHaveCount(ALL_UNITS.length);
  await page.waitForLoadState('networkidle');
  await markPage(page);

  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  return requests;
}

test.describe('Unit filter (FR-016, FR-017)', () => {
  test('typing part of a unit name narrows the list without navigating or requesting', async ({
    page,
  }) => {
    const requests = await openFaction(page);
    const urlBefore = page.url();

    await page.locator('[data-unit-filter-text]').fill('thicket');

    await expect(visibleUnits(page)).toHaveCount(1);
    await expect(visibleUnits(page)).toContainText(['Thicket Matriarch']);

    expect(await pageNeverNavigated(page)).toBe(true);
    expect(page.url()).toBe(urlBefore);
    expect(requests).toEqual([]);
  });

  test('the filter matches a unit role as well as its name', async ({ page }) => {
    await openFaction(page);

    await page.locator('[data-unit-filter-text]').fill('transport');

    await expect(visibleUnits(page)).toHaveCount(1);
    await expect(visibleUnits(page)).toContainText(['Seedpod Hauler']);
  });

  test('clearing the filter restores the full list (acceptance scenario 2)', async ({ page }) => {
    const requests = await openFaction(page);
    const field = page.locator('[data-unit-filter-text]');

    await field.fill('thicket');
    await expect(visibleUnits(page)).toHaveCount(1);

    await field.fill('');

    await expect(visibleUnits(page)).toHaveCount(ALL_UNITS.length);
    await expect(visibleUnits(page)).toContainText(ALL_UNITS);
    expect(await pageNeverNavigated(page)).toBe(true);
    expect(requests).toEqual([]);
  });

  test('a category filter narrows the same list, client-side only (FR-017)', async ({ page }) => {
    const requests = await openFaction(page);

    await page.locator('[data-unit-filter-flag]').selectOption('character');

    await expect(visibleUnits(page)).toHaveCount(1);
    await expect(visibleUnits(page)).toContainText(['Thicket Matriarch']);

    // Text and category narrowing are one code path, so they compose rather than override.
    await page.locator('[data-unit-filter-text]').fill('bramble');
    await expect(visibleUnits(page)).toHaveCount(0);

    await page.locator('[data-unit-filter-flag]').selectOption('battleline');
    await expect(visibleUnits(page)).toHaveCount(1);
    await expect(visibleUnits(page)).toContainText(['Bramble Warden']);

    expect(await pageNeverNavigated(page)).toBe(true);
    expect(requests).toEqual([]);
  });

  test('a filter matching nothing says so instead of showing an empty list', async ({ page }) => {
    await openFaction(page);

    await page.locator('[data-unit-filter-text]').fill('zzzznotaunit');

    await expect(visibleUnits(page)).toHaveCount(0);
    await expect(page.locator('[data-unit-filter-empty]')).toBeVisible();

    await page.locator('[data-unit-filter-text]').fill('');
    await expect(page.locator('[data-unit-filter-empty]')).toBeHidden();
    await expect(visibleUnits(page)).toHaveCount(ALL_UNITS.length);
  });
});
