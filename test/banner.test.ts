// AI-Assisted: Claude Code (model: claude-opus-5) - Version-banner rendering tests via Astro's
// Container API, written before src/components/VersionBanner.astro exists and confirmed failing
// first (task T015). Evidence for FR-018, FR-019 and SC-004 in both states.
//
// Container use is confined to this file on purpose: the API is still marked experimental and
// "subject to breaking changes, even in minor or patch releases", which is why astro is pinned to
// an exact version and everything else asserts against built HTML (research D6).
import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import allWithdrawn from './fixtures/manifest-all-withdrawn.json';
import current from './fixtures/manifest-current.json';
import newestWithdrawn from './fixtures/manifest-newest-withdrawn.json';

import VersionBanner from '../src/components/VersionBanner.astro';
import strings from '../src/chrome-strings.json';
import { selectCurrentVersion, type Manifest } from '../src/data/select-version';
import type { RulesVersion } from '../src/data/bundle';

/** Build the record the banner reads, exactly as src/data/bundle.ts does, without a build. */
function rulesVersionFrom(manifest: unknown, overrides: Partial<RulesVersion> = {}): RulesVersion {
  const entry = selectCurrentVersion((manifest as Manifest).versions);
  return {
    rulesVersionId: entry.rulesVersionId,
    displayName: entry.displayName,
    publishedAt: entry.publishedAt,
    withdrawn: entry.withdrawn === true,
    withdrawnReason: entry.withdrawnReason ?? null,
    bundleSha256: entry.sha256,
    sizeBytes: entry.sizeBytes,
    editionCodes: entry.editionCodes,
    sourceNote: 'Synthetic fixture data authored for tests. Every name below is invented.',
    channel: 'published',
    ...overrides,
  };
}

async function render(rulesVersion: RulesVersion): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(VersionBanner, { props: { rulesVersion } });
}

describe('VersionBanner — a non-withdrawn rules version (FR-018)', () => {
  it('names the rules version and its publication date', async () => {
    const rulesVersion = rulesVersionFrom(current);
    const html = await render(rulesVersion);

    expect(html).toContain(rulesVersion.displayName);
    expect(html).toContain(strings.banner.label);
    expect(html).toContain(strings.banner.publishedLabel);
    // Rendered locale-free and deterministically, so the same build produces the same bytes on any
    // machine and every rendered token traces back to a manifest value.
    expect(html).toContain('2026-01-15');
    expect(html).toContain(`datetime="${rulesVersion.publishedAt}"`);
  });

  it('shows no withdrawal notice at all (SC-004: 0% of pages)', async () => {
    const html = await render(rulesVersionFrom(current));

    expect(html).not.toContain(strings.banner.withdrawnHeading);
    expect(html).not.toContain(strings.banner.withdrawnReasonLabel);
    expect(html).not.toContain(strings.banner.withdrawnNoReason);
  });

  it('shows no withdrawal notice when a withdrawn newest entry was skipped for an older live one', async () => {
    const rulesVersion = rulesVersionFrom(newestWithdrawn);
    expect(rulesVersion.withdrawn).toBe(false);

    const html = await render(rulesVersion);
    expect(html).toContain(rulesVersion.displayName);
    expect(html).not.toContain(strings.banner.withdrawnHeading);
  });
});

describe('VersionBanner — a withdrawn rules version (FR-019)', () => {
  it('displays the withdrawal and its recorded reason', async () => {
    const rulesVersion = rulesVersionFrom(allWithdrawn);
    expect(rulesVersion.withdrawn).toBe(true);

    const html = await render(rulesVersion);

    expect(html).toContain(strings.banner.withdrawnHeading);
    expect(html).toContain(strings.banner.withdrawnReasonLabel);
    expect(html).toContain(rulesVersion.withdrawnReason!);
  });

  it('still names the version and date, and does not hide the reference content', async () => {
    const rulesVersion = rulesVersionFrom(allWithdrawn);
    const html = await render(rulesVersion);

    // FR-019 is explicit that the notice is added, not that content is removed.
    expect(html).toContain(rulesVersion.displayName);
    expect(html).toContain('2026-01-15');
    expect(html).toContain(strings.banner.withdrawnStanding);
  });

  it('says so plainly when the manifest recorded no reason', async () => {
    const rulesVersion = rulesVersionFrom(allWithdrawn, { withdrawnReason: null });
    const html = await render(rulesVersion);

    expect(html).toContain(strings.banner.withdrawnHeading);
    expect(html).toContain(strings.banner.withdrawnNoReason);
  });
});
