// AI-Assisted: Claude Code (model: claude-opus-5) - FR-020 rules-version selection tests, written
// before src/data/select-version.ts exists and confirmed failing first (task T011). Fixtures are
// the synthetic manifests from T010; the two degenerate manifests (empty and unsupported version)
// are built inline because they carry no bundle and are not worth a file of their own.
import { describe, expect, it } from 'vitest';

import allWithdrawn from './fixtures/manifest-all-withdrawn.json';
import current from './fixtures/manifest-current.json';
import newestWithdrawn from './fixtures/manifest-newest-withdrawn.json';

import {
  assertSupportedManifest,
  selectCurrentVersion,
  SUPPORTED_MANIFEST_VERSION,
  type Manifest,
} from '../src/data/select-version';

describe('assertSupportedManifest', () => {
  it('accepts a manifest at the supported version', () => {
    const manifest = assertSupportedManifest(current, 'fixture:manifest-current');
    expect(manifest.manifestVersion).toBe(SUPPORTED_MANIFEST_VERSION);
    expect(manifest.versions).toHaveLength(1);
  });

  it('refuses a manifest newer than this build understands', () => {
    const future = { ...current, manifestVersion: SUPPORTED_MANIFEST_VERSION + 1 };
    expect(() => assertSupportedManifest(future, 'fixture:future')).toThrow(/manifestVersion/i);
  });

  it('refuses a document that is not a manifest at all', () => {
    expect(() => assertSupportedManifest({ nope: true }, 'fixture:garbage')).toThrow();
    expect(() => assertSupportedManifest(null, 'fixture:null')).toThrow();
  });
});

describe('selectCurrentVersion (FR-020)', () => {
  it('selects the newest non-withdrawn entry', () => {
    const selected = selectCurrentVersion((current as Manifest).versions);
    expect(selected.rulesVersionId).toBe('synth-2026-01');
    expect(selected.withdrawn).toBe(false);
  });

  it('falls back to the newest older non-withdrawn entry when the newest is withdrawn', () => {
    const versions = (newestWithdrawn as Manifest).versions;
    // Guard the fixture's own premise: the newest entry by publishedAt really is withdrawn.
    const newest = [...versions].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]!;
    expect(newest.rulesVersionId).toBe('synth-2026-02');
    expect(newest.withdrawn).toBe(true);

    const selected = selectCurrentVersion(versions);
    expect(selected.rulesVersionId).toBe('synth-2026-01');
    expect(selected.withdrawn).toBe(false);
  });

  it('falls back to the newest entry outright when every entry is withdrawn, carrying the withdrawal', () => {
    const selected = selectCurrentVersion((allWithdrawn as Manifest).versions);
    expect(selected.rulesVersionId).toBe('synth-2026-01');
    expect(selected.withdrawn).toBe(true);
    expect(selected.withdrawnReason).toMatch(/correction/i);
  });

  it('orders by publishedAt, not by position in the array', () => {
    const shuffled = [...(newestWithdrawn as Manifest).versions].reverse();
    expect(selectCurrentVersion(shuffled).rulesVersionId).toBe('synth-2026-01');
  });

  it('throws when the manifest lists no versions at all', () => {
    expect(() => selectCurrentVersion([])).toThrow();
  });

  it('never returns an older non-withdrawn entry when a newer non-withdrawn entry exists', () => {
    const versions = (newestWithdrawn as Manifest).versions.filter((v) => !v.withdrawn);
    expect(versions.map((v) => v.rulesVersionId).sort()).toEqual(['synth-2025-12', 'synth-2026-01']);
    expect(selectCurrentVersion(versions).rulesVersionId).toBe('synth-2026-01');
  });
});
