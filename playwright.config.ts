// AI-Assisted: Claude Code (model: claude-opus-5) - Playwright configuration for the one behaviour
// spec the site has (tasks T033, T036; research D6).
//
// `webServer` runs the real `npm run build` and then `astro preview`, against the SYNTHETIC fixture
// manifest. Building rather than reusing whatever happens to be in dist/ is deliberate: the spec
// asserts that no request is made while filtering, which is only meaningful if the pages under test
// are the ones this repository's build produces, and `npm run build` is the exact command
// Cloudflare Workers Builds runs (research D3).
//
// One browser (chromium) and no parallel projects: the filter is plain DOM API use with no
// vendor-specific surface, and a second engine would double the CI cost of the suite for no signal.
//
// AI-Assisted note (model: Claude Sonnet 5, 005-rules-web-enrichment-display task T020): the
// webServer now builds from `manifest-enriched.json` instead of `manifest-current.json`, so
// e2e/keyword-glossary.spec.ts has real glossary-covered keywords, army rules, and detachment
// rules to click, hover, and tab through in an actual browser. This is safe for filter.spec.ts:
// the enriched fixture is a strict superset of the current one (same factions, detachments, and
// datasheets, with only additive 004 arrays appended), so every entity and filter-relevant field
// filter.spec.ts asserts against is unchanged. The pre-004 (no-enrichment) case does not need its
// own e2e coverage - it is already proven, extensively, by the Vitest suite's `current` build.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const HOST = '127.0.0.1';

/** Both are forced so an e2e run can never build against the live published manifest. */
const FIXTURE_ENV = {
  WGC_WEB_CHANNEL: 'published',
  WGC_WEB_MANIFEST_URL: './test/fixtures/manifest-enriched.json',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --host ${HOST} --port ${PORT}`,
    url: `http://${HOST}:${PORT}${'/'}`,
    env: FIXTURE_ENV,
    reuseExistingServer: !process.env.CI,
    // A cold `npm run build` (astro check, build, build-info, verify-dist) dominates this.
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
