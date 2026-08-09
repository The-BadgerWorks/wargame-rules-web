// AI-Assisted: Claude Code (model: Claude Sonnet 5) - Conformance vectors for
// normalizeKeywordKey() and resolveGlossary() (005-rules-web-enrichment-display task T014),
// written after src/data/glossary.ts.
//
// Evidence for spec.md FR-010 (resolution follows the bundle's published normative
// normalization, and the site introduces no additional normalization of its own) and the Edge
// Cases for a parameterized keyword pair sharing one glossary entry.
//
// This file tests the pure five-step procedure (bundle-schema-delta.md v1.1.0 section 4) in
// isolation from any built bundle, and resolveGlossary() against a synthetic map passed
// explicitly - not against whichever fixture vitest.config.ts's global WGC_WEB_MANIFEST_URL
// happens to load, which is the pre-004 fixture and therefore carries no glossary data at all.
// Resolution against the REAL enriched glossary is proven end-to-end, on rendered pages, by
// test/us-keyword-glossary.test.ts.
import { describe, expect, it } from 'vitest';

import { normalizeKeywordKey, resolveGlossary } from '../src/data/glossary.ts';
import type { KeywordGlossaryEntry } from '../src/data/bundle.ts';

describe('normalizeKeywordKey (bundle-schema-delta.md section 4)', () => {
  it('strips a trailing numeric parameter and reports it, so variants share one key', () => {
    expect(normalizeKeywordKey('SUSTAINED HITS 2')).toEqual({
      key: 'sustained hits',
      hasNumericParameter: true,
    });
    expect(normalizeKeywordKey('Sustained Hits 1')).toEqual({
      key: 'sustained hits',
      hasNumericParameter: true,
    });
  });

  it('runs NFKC before detecting a trailing digit run, so a compatibility-decomposable digit is caught', () => {
    // U+00B2 SUPERSCRIPT TWO NFKC-decomposes to the ASCII digit "2". If step 1 ran after step 5
    // instead of before it, the superscript would not be \d yet and this would wrongly report no
    // numeric parameter.
    const superscriptTwo = 'Sustained Hits ²';
    expect(normalizeKeywordKey(superscriptTwo)).toEqual({
      key: 'sustained hits',
      hasNumericParameter: true,
    });
  });

  it('normalises a precomposed accent and a combining-accent sequence to the same key (NFKC)', () => {
    const precomposedForm = 'Précision'; // "e" + acute as one code point (U+00E9)
    const combiningForm = 'Précision'; // "e" (U+0065) followed by combining acute (U+0301)
    expect(precomposedForm).not.toBe(combiningForm); // distinct source strings, by construction
    expect(precomposedForm.normalize('NFC')).toBe(combiningForm.normalize('NFC')); // sanity check

    const precomposed = normalizeKeywordKey(precomposedForm);
    const combining = normalizeKeywordKey(combiningForm);
    expect(precomposed.key).toBe(combining.key);
    expect(precomposed).toEqual({ key: 'précision', hasNumericParameter: false });
  });

  it('treats punctuation as equivalent to a space, so a hyphenated form matches a spaced one', () => {
    expect(normalizeKeywordKey('Anti-Vehicle')).toEqual({
      key: 'anti vehicle',
      hasNumericParameter: false,
    });
    expect(normalizeKeywordKey('Anti Vehicle')).toEqual({
      key: 'anti vehicle',
      hasNumericParameter: false,
    });
  });

  it('collapses runs of internal whitespace to one space', () => {
    expect(normalizeKeywordKey('Devastating   Wounds')).toEqual({
      key: 'devastating wounds',
      hasNumericParameter: false,
    });
  });

  it('does not strip digits with nothing preceding them to be "a space" (pure-numeric edge)', () => {
    // A bare numeric string has no preceding space to remove, so stripping it would be inventing a
    // rule the procedure does not state - and would otherwise produce an empty, useless key.
    expect(normalizeKeywordKey('40')).toEqual({ key: '40', hasNumericParameter: false });
  });

  it('does not strip a digit run that is not at the very end of the string', () => {
    expect(normalizeKeywordKey('Sustained Hits 2 Bonus')).toEqual({
      key: 'sustained hits 2 bonus',
      hasNumericParameter: false,
    });
  });

  it('does not collapse two genuinely different keywords to the same key (no invented stemming)', () => {
    const hits = normalizeKeywordKey('Lethal Hits');
    const hit = normalizeKeywordKey('Lethal Hit');
    expect(hits.key).not.toBe(hit.key);
  });
});

describe('resolveGlossary', () => {
  const sustainedHits: KeywordGlossaryEntry = {
    keywordKey: 'sustained hits',
    displayKeyword: 'Sustained Hits',
    hasNumericParameter: true,
    summary: "Each of this weapon's successful hit rolls of 6 scores that many additional hits.",
  };
  const glossary = new Map<string, KeywordGlossaryEntry>([[sustainedHits.keywordKey, sustainedHits]]);

  it('resolves every numeric variant of a parameterized keyword to the one entry', () => {
    expect(resolveGlossary('SUSTAINED HITS 1', glossary)).toBe(sustainedHits);
    expect(resolveGlossary('Sustained Hits 2', glossary)).toBe(sustainedHits);
  });

  it('returns undefined for a keyword the glossary does not cover (no-match case)', () => {
    expect(resolveGlossary('Overwatch', glossary)).toBeUndefined();
  });
});
