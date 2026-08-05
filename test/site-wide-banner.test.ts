// AI-Assisted: Claude Code (model: claude-opus-5) - SC-004 measured over whole builds rather than
// over one component (tasks T038, T039; FR-018, FR-019, FR-020, FR-025 support).
//
// test/banner.test.ts already proves VersionBanner.astro renders correctly in both states. That is
// a different claim from the one SC-004 makes. SC-004 is about coverage - "100% of rendered pages"
// and "0% of pages" - and coverage can only be counted over the actual set of pages a build
// produced. A component test cannot notice a page template that forgot BaseLayout; this one can,
// because it walks dist-test/**/*.html and requires every single file to pass.
//
// The suite therefore builds the fixtures twice (test/helpers/built-site.ts): once from the
// non-withdrawn manifest and once from the all-entries-withdrawn manifest, which is the only way to
// evidence both halves of SC-004 in one run.
import { describe, expect, it } from 'vitest';

import allWithdrawn from './fixtures/manifest-all-withdrawn.json';
import current from './fixtures/manifest-current.json';
import {
  allPages,
  buildInfo,
  OUT_DIR,
  OUT_DIR_WITHDRAWN,
  page,
  text,
} from './helpers/built-site.ts';
import strings from '../src/chrome-strings.json';

/** The entry FR-020 selects from each fixture manifest: newest live, else newest outright. */
const LIVE = current.versions[0]!;
const WITHDRAWN = allWithdrawn.versions[1]!;

/** An entry FR-020 does NOT select, so its id must appear nowhere in a build (FR-020 negative). */
const NOT_SELECTED = allWithdrawn.versions[0]!;

const BANNER = 'data-version-banner';
const WITHDRAWAL = 'data-withdrawal-notice';

describe('SC-004 — the version banner on 100% of pages', () => {
  it('renders on every page of the non-withdrawn build, with the version name and date', async () => {
    const pages = await allPages(OUT_DIR);
    expect(pages.size).toBeGreaterThan(1);

    const missing = [...pages]
      .filter(
        ([, html]) =>
          !html.includes(BANNER) ||
          !html.includes(LIVE.displayName) ||
          !html.includes(LIVE.publishedAt.slice(0, 10)),
      )
      .map(([file]) => file);

    expect(missing).toEqual([]);
  });

  it('renders on every page of the withdrawn build too', async () => {
    const pages = await allPages(OUT_DIR_WITHDRAWN);
    expect(pages.size).toBeGreaterThan(1);

    const missing = [...pages]
      .filter(([, html]) => !html.includes(BANNER) || !html.includes(WITHDRAWN.displayName))
      .map(([file]) => file);

    expect(missing).toEqual([]);
  });

  it('carries the disclaimer on every page of both builds (FR-023)', async () => {
    for (const outDir of [OUT_DIR, OUT_DIR_WITHDRAWN]) {
      const pages = await allPages(outDir);
      const missing = [...pages]
        .filter(([, html]) => !html.includes('data-disclaimer'))
        .map(([file]) => `${outDir}/${file}`);
      expect(missing).toEqual([]);
    }
  });
});

describe('SC-004 — the withdrawal notice on 100% and on 0% of pages', () => {
  it('appears on 0% of pages when the selected version is not withdrawn', async () => {
    const pages = await allPages(OUT_DIR);

    const withNotice = [...pages]
      .filter(
        ([, html]) => html.includes(WITHDRAWAL) || html.includes(strings.banner.withdrawnHeading),
      )
      .map(([file]) => file);

    expect(withNotice).toEqual([]);
  });

  it('appears on 100% of pages, with its recorded reason, when it is', async () => {
    const pages = await allPages(OUT_DIR_WITHDRAWN);

    const without = [...pages]
      .filter(
        ([, html]) =>
          !html.includes(WITHDRAWAL) ||
          !html.includes(strings.banner.withdrawnHeading) ||
          !html.includes(WITHDRAWN.withdrawnReason),
      )
      .map(([file]) => file);

    expect(without).toEqual([]);
  });

  it('adds the notice without hiding any reference content (FR-019)', async () => {
    const live = await page('/factions/verdant-concord/units/thicket-matriarch/', OUT_DIR);
    const withdrawn = await page(
      '/factions/verdant-concord/units/thicket-matriarch/',
      OUT_DIR_WITHDRAWN,
    );

    // The datacard's own content is identical in both builds; only the banner differs.
    for (const fragment of ['Thicket Matriarch', strings.headings.models, strings.headings.points]) {
      expect(text(withdrawn)).toContain(fragment);
      expect(text(live)).toContain(fragment);
    }
  });
});

describe('dist/build-info.json (contracts/rebuild-notification.md §4)', () => {
  it('records the version the non-withdrawn build was rendered from, and nothing else', async () => {
    const info = await buildInfo(OUT_DIR);

    expect(Object.keys(info).sort()).toEqual([
      'builtFromCommit',
      'bundleSha256',
      'channel',
      'rulesVersionId',
      'withdrawn',
    ]);
    expect(info.rulesVersionId).toBe(LIVE.rulesVersionId);
    expect(info.bundleSha256).toBe(LIVE.sha256);
    expect(info.withdrawn).toBe(false);
    expect(info.channel).toBe('published');
    expect(String(info.builtFromCommit).length).toBeGreaterThan(0);
  });

  it('records the withdrawal for the withdrawn build, so the watch can see it', async () => {
    const info = await buildInfo(OUT_DIR_WITHDRAWN);

    expect(info.rulesVersionId).toBe(WITHDRAWN.rulesVersionId);
    expect(info.withdrawn).toBe(true);
  });
});

describe('FR-020 — no page offers switching between rules versions', () => {
  it('emits no version-scoped route and links to no other rules version', async () => {
    const pages = await allPages(OUT_DIR);

    for (const [file, html] of pages) {
      // D1 defines no /v/<rulesVersionId>/ route, and no version list is ever fetched, so a link
      // to another version cannot exist. This asserts the negative rather than assuming it.
      expect(file.startsWith('v/'), file).toBe(false);
      expect(html, file).not.toContain('href="/v/');
      expect(html, file).not.toContain(NOT_SELECTED.rulesVersionId);
      // The only <select> the site renders is the filter's category control (task T034).
      const selects = [...html.matchAll(/<select[^>]*>/g)].map((match) => match[0]);
      for (const select of selects) {
        expect(select, file).toContain('data-unit-filter-flag');
      }
    }
  });
});
