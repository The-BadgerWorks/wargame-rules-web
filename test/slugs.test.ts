// AI-Assisted: Claude Code (model: claude-opus-5) - Research D1 slug-derivation tests, written
// before src/data/slugs.ts exists and confirmed failing first (task T011). D1's claim is that
// prefix-stripping is a bijection within each entity type, so the site inherits URL stability from
// 002's stable ids rather than re-engineering it; these tests are what turns that claim into a
// build-time assertion.
import { describe, expect, it } from 'vitest';

import bundle from './fixtures/bundle-synth.json';

import { assertUniqueSlugs, detachSlug, factionCode, SLUG_PATTERN, unitSlug } from '../src/data/slugs';

describe('factionCode', () => {
  it('passes a well-formed code through unchanged', () => {
    expect(factionCode('verdant-outriders')).toBe('verdant-outriders');
  });

  it('rejects a code outside the URL charset', () => {
    expect(() => factionCode('Verdant Outriders')).toThrow();
    expect(() => factionCode('verdant_outriders')).toThrow();
    expect(() => factionCode('')).toThrow();
  });
});

describe('detachSlug', () => {
  it('strips the d- prefix', () => {
    expect(detachSlug('d-tangle-vanguard')).toBe('tangle-vanguard');
  });

  it('rejects an id that does not carry the d- prefix', () => {
    expect(() => detachSlug('tangle-vanguard')).toThrow();
    expect(() => detachSlug('ds-bramble-warden')).toThrow();
  });

  it('rejects an id that is nothing but the prefix', () => {
    expect(() => detachSlug('d-')).toThrow();
  });

  it('rejects an id that would produce a slug outside the URL charset', () => {
    expect(() => detachSlug('d-Tangle_Vanguard')).toThrow();
  });
});

describe('unitSlug', () => {
  it('strips the ds- prefix', () => {
    expect(unitSlug('ds-bramble-warden')).toBe('bramble-warden');
  });

  it('rejects an id that does not carry the ds- prefix', () => {
    expect(() => unitSlug('bramble-warden')).toThrow();
    expect(() => unitSlug('d-tangle-vanguard')).toThrow();
  });

  it('rejects an id that is nothing but the prefix', () => {
    expect(() => unitSlug('ds-')).toThrow();
  });

  it('rejects an id that would produce a slug outside the URL charset', () => {
    expect(() => unitSlug('ds-Bramble Warden')).toThrow();
  });
});

describe('assertUniqueSlugs', () => {
  it('accepts a unique set', () => {
    expect(() => assertUniqueSlugs('unit', ['a', 'b', 'c'])).not.toThrow();
  });

  it('fails the build on a collision, naming the colliding slug', () => {
    expect(() => assertUniqueSlugs('unit', ['a', 'b', 'a'])).toThrow(/a/);
  });
});

describe('prefix stripping is a bijection per type, over the fixture bundle', () => {
  it('derives a unique, charset-clean slug for every detachment', () => {
    const slugs = bundle.detachments.map((d) => detachSlug(d.id));
    expect(slugs).toHaveLength(bundle.detachments.length);
    expect(new Set(slugs).size).toBe(bundle.detachments.length);
    for (const slug of slugs) expect(slug).toMatch(SLUG_PATTERN);
    expect(() => assertUniqueSlugs('detachment', slugs)).not.toThrow();
  });

  it('derives a unique, charset-clean slug for every datasheet', () => {
    const slugs = bundle.datasheets.map((d) => unitSlug(d.id));
    expect(slugs).toHaveLength(bundle.datasheets.length);
    expect(new Set(slugs).size).toBe(bundle.datasheets.length);
    for (const slug of slugs) expect(slug).toMatch(SLUG_PATTERN);
    expect(() => assertUniqueSlugs('unit', slugs)).not.toThrow();
  });

  it('derives a unique, charset-clean code for every faction', () => {
    const codes = bundle.factions.map((f) => factionCode(f.code));
    expect(new Set(codes).size).toBe(bundle.factions.length);
    for (const code of codes) expect(code).toMatch(SLUG_PATTERN);
  });

  it('keeps detachment and unit slugs in disjoint URL namespaces, so they cannot collide', () => {
    // D1: /factions/<code>/detachments/<slug>/ and /factions/<code>/units/<slug>/. A detachment and
    // a unit may legitimately share a slug; what must never happen is a collision within one type.
    const detachments = bundle.detachments.map((d) => detachSlug(d.id));
    const units = bundle.datasheets.map((d) => unitSlug(d.id));
    expect(new Set(detachments).size + new Set(units).size).toBe(detachments.length + units.length);
  });
});
