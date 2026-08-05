// AI-Assisted: Claude Code (model: claude-opus-5) - Vitest configuration for the rules-reference
// site (research D6). getViteConfig() from astro/config is what lets a test import .astro files at
// all, which the version-banner test needs. Every test runs against the SYNTHETIC fixtures in
// test/fixtures/ - never the live manifest - so the suite is offline and deterministic.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: {
      WGC_WEB_CHANNEL: 'published',
      WGC_WEB_MANIFEST_URL: './test/fixtures/manifest-current.json',
    },
  },
});
