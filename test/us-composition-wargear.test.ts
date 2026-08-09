// AI-Assisted: Claude Code (model: Claude Sonnet 5) - User Story 1's rendering test
// (005-rules-web-enrichment-display task T012), written after UnitComposition.astro,
// WargearOptions.astro, the CostTable.astro fallback rework, and the unit page integration.
//
// Evidence for spec.md FR-004 through FR-009, US1 acceptance scenarios 1-5, and SC-002.
//
// This suite asserts against the `enriched` build (test/fixtures/bundle-synth-enriched.json), the
// only fixture that carries composition and full wargear option data. The pre-004 absence case is
// proven separately: test/us2-unit-datacard.test.ts already asserts the `current` build's unit
// pages show neither section, against a fixture the Bundle type extension left untouched.
import { describe, expect, it } from 'vitest';

import strings from '../src/chrome-strings.json';
import bundle from './fixtures/bundle-synth-enriched.json';
import { attrValues, OUT_DIR_ENRICHED, page, rows, text } from './helpers/built-site.ts';

const BRAMBLE_WARDEN = '/factions/verdant-concord/units/bramble-warden/';
const CHOIR_ECHO = '/factions/hollow-choir/units/choir-echo/';
const LATTICE_DRONE = '/factions/iron-tessellate/units/lattice-drone/';
const SWIFTWING_SCOUT = '/factions/verdant-outriders/units/swiftwing-scout/';
const THICKET_MATRIARCH = '/factions/verdant-concord/units/thicket-matriarch/';

const enrichedPage = (route: string) => page(route, OUT_DIR_ENRICHED);

describe('Unit composition (FR-004, FR-005, US1 scenarios 1 and 4)', () => {
  it('shows one line per model with its published minimum and maximum count', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const composition = bundle.datasheetCompositions.filter(
      (c) => c.datasheetId === 'ds-bramble-warden',
    );
    expect(composition.length).toBe(2);

    expect(html).toContain('data-composition-section');
    expect(text(html)).toContain(strings.headings.composition);
    expect(attrValues(html, 'composition')).toEqual(composition.map((c) => String(c.line)));

    const rendered = rows(html, 'composition');
    const first = rendered.get('1')!;
    expect(text(first)).toContain('Bramble Warden');
    expect(text(first)).toContain('4');
    expect(text(first)).toContain('9');

    const second = rendered.get('2')!;
    expect(text(second)).toContain('Bramble Warden Elder');
    // A fixed-size line (min = max = 1) is a real value, not missing data.
    expect(text(second)).toContain('1');
  });

  it('shows a composition-only unit with no wargear section at all', async () => {
    const html = await enrichedPage(CHOIR_ECHO);

    expect(attrValues(html, 'composition')).toEqual(['1']);
    expect(text(html)).toContain(strings.headings.composition);
    expect(attrValues(html, 'wargear')).toEqual([]);
    expect(attrValues(html, 'option-choice')).toEqual([]);
    expect(text(html)).not.toContain(strings.headings.wargearOptions);
  });

  it('shows no composition section at all for a unit whose bundle entry carries none', async () => {
    const html = await enrichedPage(THICKET_MATRIARCH);

    expect(attrValues(html, 'composition')).toEqual([]);
    expect(html).not.toContain('data-composition-section');
    expect(text(html)).not.toContain(strings.headings.composition);
  });
});

describe('Full wargear options (FR-006, FR-007, US1 scenario 2)', () => {
  it('shows every option group and choice, with scope, count, and cost where priced', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);

    expect(html).toContain('data-wargear-options');
    expect(html).toContain('data-option-group="og-bramble-warden-1"');
    expect(html).toContain('data-option-group-scope="per_n_models"');
    expect(text(html)).toContain(strings.wargearScopes.per_n_models);
    expect(attrValues(html, 'option-scope-n')).toEqual(['5']);

    expect(attrValues(html, 'option-choice')).toEqual([
      'oc-bramble-warden-1-1',
      'oc-bramble-warden-1-2',
      'oc-bramble-warden-1-3',
    ]);

    const choices = rows(html, 'option-choice');

    const thornlance = choices.get('oc-bramble-warden-1-1')!;
    expect(text(thornlance)).toContain('Thornlance');
    expect(thornlance).toContain('data-option-points="5"');
    expect(text(thornlance)).toContain('+5');
  });

  it('lists an unpriced choice without a cost figure, never as free (FR-007)', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const standard = rows(html, 'option-choice').get('oc-bramble-warden-1-2')!;

    expect(text(standard)).toContain('Bramble Standard');
    expect(standard).not.toContain('data-option-points');
  });

  it('marks an explicit "no change" choice as selectable, not as a free addition (Edge Cases)', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const noChange = rows(html, 'option-choice').get('oc-bramble-warden-1-3')!;

    expect(text(noChange)).toContain('No change');
    expect(noChange).toContain('data-flag="no-change"');
    expect(text(noChange)).toContain(strings.flags.noChange);
    expect(noChange).toContain('data-flag="default"');
    expect(noChange).not.toContain('data-option-points');
  });

  it('shows a group scoped to the whole unit distinctly from one scoped per N models', async () => {
    const html = await enrichedPage(LATTICE_DRONE);

    expect(html).toContain('data-option-group-scope="unit"');
    expect(text(html)).toContain(strings.wargearScopes.unit);
    expect(html).not.toContain('data-option-scope-n');

    const pulseArray = rows(html, 'option-choice').get('oc-lattice-drone-1-1')!;
    expect(pulseArray).toContain('data-flag="default"');
    expect(pulseArray).not.toContain('data-option-points');

    const heavyBeamer = rows(html, 'option-choice').get('oc-lattice-drone-1-2')!;
    expect(heavyBeamer).toContain('data-option-points="15"');
    expect(text(heavyBeamer)).toContain('+15');
  });
});

describe('Merged display supersedes the flat table (FR-008, US1 scenario 3, SC-002)', () => {
  it('does not also render the flat cost-only wargear table once the full structure is shown', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);

    // The legacy flat option (wg-bramble-thornlance) exists in the bundle for this datasheet, but
    // must not render as its own table row once the merged display supersedes it (FR-008).
    expect(attrValues(html, 'wargear')).toEqual([]);
  });

  it('represents every choice the flat table would have shown, in the merged display (SC-002)', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const flatOption = bundle.datasheetWargearOptions.find((o) => o.id === 'wg-bramble-thornlance')!;
    const mergedChoice = bundle.datasheetOptionChoices.find(
      (c) => c.id === 'oc-bramble-warden-1-1',
    )!;

    // Same name, same points delta - the flat table's one row loses no information in the move.
    expect(mergedChoice.name).toBe(flatOption.name);
    expect(mergedChoice.pointsDelta).toBe(flatOption.pointsDelta);

    const row = rows(html, 'option-choice').get('oc-bramble-warden-1-1')!;
    expect(text(row)).toContain(flatOption.name);
    expect(row).toContain(`data-option-points="${flatOption.pointsDelta}"`);
  });
});

describe('Flat-table fallback when no option groups are published (FR-009)', () => {
  it('falls back to the cost-bearing wargear table unchanged for a unit with no option groups', async () => {
    const html = await enrichedPage(SWIFTWING_SCOUT);
    const flat = bundle.datasheetWargearOptions.filter((o) => o.datasheetId === 'ds-swiftwing-scout');
    expect(flat.length).toBe(1);

    expect(attrValues(html, 'wargear')).toEqual(flat.map((o) => o.id));
    expect(attrValues(html, 'option-choice')).toEqual([]);
    expect(html).not.toContain('data-wargear-options');

    const row = rows(html, 'wargear').get('wg-swiftwing-marksman')!;
    expect(text(row)).toContain("Marksman's Rifle");
    expect(row).toContain('data-wargear-delta="8"');
  });
});
