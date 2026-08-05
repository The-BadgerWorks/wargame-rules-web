// AI-Assisted: Claude Code (model: claude-opus-5) - Astro static-build configuration for the
// rules-reference site (tasks T002, T018): static output (FR-021), one canonical trailing-slash
// address per page per research D1, and the canonical base URL read from src/config.ts so the two
// environments differ only by variable and never by logic.
import { defineConfig } from 'astro/config';

import { SITE_URL } from './src/config.ts';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  site: SITE_URL,
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
