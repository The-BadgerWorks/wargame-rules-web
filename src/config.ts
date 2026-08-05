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
