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
import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const HOST = '127.0.0.1';

/** Both are forced so an e2e run can never build against the live published manifest. */
const FIXTURE_ENV = {
  WGC_WEB_CHANNEL: 'published',
  WGC_WEB_MANIFEST_URL: './test/fixtures/manifest-current.json',
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
