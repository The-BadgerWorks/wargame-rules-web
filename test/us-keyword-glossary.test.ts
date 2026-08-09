// AI-Assisted: Claude Code (model: Claude Sonnet 5) - User Story 2's rendering test
// (005-rules-web-enrichment-display task T019), written after glossary.ts, KeywordTag.astro, and
// its integration into WeaponTable.astro and the unit page.
//
// Evidence for spec.md FR-010 through FR-014 and US2 acceptance scenarios 1-4.
//
// `data-keyword-glossary="<keywordKey>"` only appears on the `<details>` a resolved keyword
// renders (contracts/render-contract.md section 2), so `attrValues(html, 'keyword-glossary')` is
// this suite's main instrument: it names exactly which keyword instances on a page resolved, in
// document order, with no need to guess at Astro's exact whitespace output for the unresolved
// case - an uncovered keyword simply never appears in that list.
import { describe, expect, it } from 'vitest';

import bundle from './fixtures/bundle-synth-enriched.json';
import { attrValues, countAttr, OUT_DIR_ENRICHED, page, rows, text } from './helpers/built-site.ts';

const BRAMBLE_WARDEN = '/factions/verdant-concord/units/bramble-warden/';
const CHOIR_ECHO = '/factions/hollow-choir/units/choir-echo/';
const LATTICE_DRONE = '/factions/iron-tessellate/units/lattice-drone/';
const WITHERSTALK_RELIC = '/factions/verdant-concord/units/witherstalk-relic/';

const enrichedPage = (route: string) => page(route, OUT_DIR_ENRICHED);

function glossaryEntry(keywordKey: string) {
  const entry = bundle.keywordGlossary.find((g) => g.keywordKey === keywordKey);
  if (!entry) throw new Error(`Fixture has no glossary entry for "${keywordKey}".`);
  return entry;
}

describe('Covered keywords expose their definition (FR-010, US2 scenarios 1 and 2)', () => {
  it("exposes a covered unit keyword's definition, verbatim, in place", async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const battleline = glossaryEntry('battleline');

    expect(attrValues(html, 'keyword-glossary')).toEqual(['battleline']);

    const fragment = rows(html, 'keyword-glossary').get('battleline')!;
    expect(text(fragment)).toContain('Battleline');
    expect(text(fragment)).toContain(battleline.summary);
  });

  it("exposes a covered weapon ability keyword's definition the same way as a unit keyword", async () => {
    const html = await enrichedPage(LATTICE_DRONE);
    const lethalHits = glossaryEntry('lethal hits');

    expect(attrValues(html, 'keyword-glossary')).toContain('lethal hits');

    const fragment = rows(html, 'keyword-glossary').get('lethal hits')!;
    expect(text(fragment)).toContain('lethal hits');
    expect(text(fragment)).toContain(lethalHits.summary);
  });
});

describe('Parameterized keyword variants resolve to one glossary entry (Edge Cases)', () => {
  it('resolves "sustained hits 1" and "sustained hits 2" to the same normalised entry', async () => {
    const sustainedHits = glossaryEntry('sustained hits');

    const droneHtml = await enrichedPage(LATTICE_DRONE);
    expect(attrValues(droneHtml, 'keyword-glossary')).toContain('sustained hits');
    const droneFragment = rows(droneHtml, 'keyword-glossary').get('sustained hits')!;
    expect(text(droneFragment)).toContain(sustainedHits.summary);

    const relicHtml = await enrichedPage(WITHERSTALK_RELIC);
    expect(attrValues(relicHtml, 'keyword-glossary')).toEqual(['sustained hits']);
    const relicFragment = rows(relicHtml, 'keyword-glossary').get('sustained hits')!;
    expect(text(relicFragment)).toContain(sustainedHits.summary);
  });
});

describe('Uncovered keywords render exactly as today (FR-012, US2 scenario 3)', () => {
  it('shows an uncovered unit keyword as a plain tag, with no glossary affordance', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const keywords = bundle.datasheetKeywords.filter((k) => k.datasheetId === 'ds-bramble-warden');

    // Every keyword still carries the pre-existing bare `data-keyword` marker...
    expect(countAttr(html, 'keyword')).toBe(keywords.length);
    for (const keyword of keywords) {
      expect(text(html)).toContain(keyword.keyword);
    }
    // ...but only the one the glossary covers ("Battleline") resolved to a `<details>`.
    expect(attrValues(html, 'keyword-glossary')).toEqual(['battleline']);
  });

  it('renders zero glossary affordances on a page with no covered keywords at all', async () => {
    const html = await enrichedPage(CHOIR_ECHO);
    const keywords = bundle.datasheetKeywords.filter((k) => k.datasheetId === 'ds-choir-echo');

    expect(keywords.length).toBeGreaterThan(0);
    expect(attrValues(html, 'keyword-glossary')).toEqual([]);
    expect(html).not.toContain('<details');
    for (const keyword of keywords) {
      expect(text(html)).toContain(keyword.keyword);
    }
  });
});
