// AI-Assisted: Claude Code (model: claude-opus-5) - Build-time configuration for the
// rules-reference site (task T013 introduces the data-source half; task T018 completes it with the
// production-channel assertion and the preview noindex). Every value is a documented, defaulted,
// overridable environment variable; none of them is sensitive, and there is no secret to embed
// because serving the site requires no credential (FR-001).

/** Manifest channels this site knows about. FR-002 permits only `published` to be deployed. */
export const CHANNELS = ['published', 'prerelease'] as const;
export type Channel = (typeof CHANNELS)[number];

const DEFAULT_MANIFEST_URLS: Record<Channel, string> = {
  published: 'https://the-badgerworks.github.io/wargame-rules-data/manifest.json',
  prerelease: 'https://the-badgerworks.github.io/wargame-rules-data/prerelease/manifest.json',
};

function readChannel(): Channel {
  const raw = process.env.WGC_WEB_CHANNEL ?? 'published';
  if (!(CHANNELS as readonly string[]).includes(raw)) {
    throw new Error(
      `WGC_WEB_CHANNEL is "${raw}", which is not one of: ${CHANNELS.join(', ')}.`,
    );
  }
  return raw as Channel;
}

/** Which manifest channel this build reads. */
export const CHANNEL: Channel = readChannel();

/**
 * The manifest to build from. Accepts an absolute URL (`https:` or `file:`) or a local filesystem
 * path, which is what lets the whole pipeline be exercised against the synthetic fixtures without
 * a network or a special code path.
 */
export const MANIFEST_URL: string = process.env.WGC_WEB_MANIFEST_URL ?? DEFAULT_MANIFEST_URLS[CHANNEL];

/**
 * Cache the verified bundle under node_modules/.cache so `astro dev` restarts do not re-download
 * 6.4 MB. CI always fetches: a cache that survives a build is a way for a stale artifact to be
 * rendered as current.
 */
export const USE_BUNDLE_CACHE: boolean = !process.env.CI;

// ---------------------------------------------------------------------------
// Which build is this? (task T018)
//
// Cloudflare Workers Builds runs the same build command for every branch and differs only in its
// deploy command - `wrangler deploy` promotes, `wrangler versions upload` does not. The build
// itself therefore has to read the branch to know whether it is producing the production site.
// WORKERS_CI_BRANCH is the variable Workers Builds sets; WGC_WEB_BRANCH overrides it, which is what
// lets this path be exercised locally and keeps a rename upstream from being a code change.
// Both are recorded in docs/cloudflare-settings.md §5 as declared build-environment assumptions.
// ---------------------------------------------------------------------------

export const PRODUCTION_BRANCH = 'main';

export const BRANCH: string = process.env.WGC_WEB_BRANCH ?? process.env.WORKERS_CI_BRANCH ?? '';

/** True only for a build of the production branch, which is the build that gets promoted. */
export const IS_PRODUCTION_BUILD: boolean = BRANCH === PRODUCTION_BRANCH;

// FR-002 enforced structurally rather than by convention: a production build against anything but
// the published channel fails here, before a page is rendered, rather than being caught in review.
if (IS_PRODUCTION_BUILD && CHANNEL !== 'published') {
  throw new Error(
    `A production build (branch "${BRANCH}") may only be generated from the published manifest ` +
      `channel, but WGC_WEB_CHANNEL is "${CHANNEL}" (FR-002). Refusing to build.`,
  );
}

/** The canonical base URL. Changing hostname is a configuration change, never a code change. */
export const SITE_URL: string =
  process.env.WGC_WEB_SITE_URL ?? 'https://wargame-rules-web.workers.dev';

/**
 * Preview builds are publicly addressable, so they must not be indexable - a preview must never
 * outrank the production site or present stale data as current (research D3, caveat 4).
 */
export const NOINDEX: boolean = !IS_PRODUCTION_BUILD || CHANNEL !== 'published';
