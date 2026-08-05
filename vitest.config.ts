// AI-Assisted: Claude Code (model: claude-opus-5) - Vitest configuration for the rules-reference
// site (research D6). getViteConfig() from astro/config is what lets a test import .astro files at
// all, which the version-banner test needs. Every test runs against the SYNTHETIC fixtures in
// test/fixtures/ - never the live manifest - so the suite is offline and deterministic.
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // One real `astro build` against the fixtures, before the first test file, into dist-test/.
    // Page-level tests assert against that built HTML (research D6); see test/helpers/built-site.ts.
    globalSetup: ['./test/helpers/built-site.ts'],
    // The build is a child process, so the first file to touch it needs more than the 5s default.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      WGC_WEB_CHANNEL: 'published',
      WGC_WEB_MANIFEST_URL: './test/fixtures/manifest-current.json',
    },
  },
});
