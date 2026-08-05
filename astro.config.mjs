// AI-Assisted: Claude Code (model: claude-opus-5) - Astro static-build configuration for the
// rules-reference site (task T002): static output (FR-021) and one canonical trailing-slash
// address per page per research D1.
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  site: process.env.WGC_WEB_SITE_URL ?? 'https://wargame-rules-web.workers.dev',
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
