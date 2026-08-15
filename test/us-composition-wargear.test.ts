// AI-Assisted: Claude Code (model: Claude Sonnet 5) - User Story 1's rendering test
// (005-rules-web-enrichment-display task T012), written after UnitComposition.astro,
// WargearOptions.astro, the CostTable.astro fallback rework, and the unit page integration.
//
// AI-Assisted note (model: Claude Sonnet 5, prose-composition-wargear branch): rewritten for the
// count-first composition lines, the unit-size points lines UnitComposition absorbed from
// CostTable, the per-group sentence + dash-list wargear presentation, and the
// wargearOptionState === 'partial' note. `data-composition`, `data-cost`/`data-cost-points`/
// `data-cost-confidence`, `data-option-group`/`data-option-group-scope`/`data-option-scope-n`, and
// `data-option-choice`/`data-option-points` are unchanged attribute names on new element shapes,
// so this suite still locates rows the same way; only what it asserts about their TEXT changed.
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
const WITHERSTALK_RELIC = '/factions/verdant-concord/units/witherstalk-relic/';

const enrichedPage = (route: string) => page(route, OUT_DIR_ENRICHED);

describe('Unit composition as count-first lines (FR-004, FR-005, US1 scenarios 1 and 4)', () => {
  it('shows a ranged model line as "{min}-{max} {name}" and a fixed one as "{n} {name}"', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const composition = bundle.datasheetCompositions.filter(
      (c) => c.datasheetId === 'ds-bramble-warden',
    );
    expect(composition.length).toBe(2);

    expect(html).toContain('data-composition-section');
    expect(text(html)).toContain(strings.headings.composition);
    expect(attrValues(html, 'composition')).toEqual(composition.map((c) => String(c.line)));

    const rendered = rows(html, 'composition');
    // Ranged (min 4, max 9): count-first, hyphenated range, no separate min/max labels. Checked
    // against the RAW fragment, not text(): text() replaces every tag with a space, so it cannot
    // represent "4-9" as adjacent characters even when the markup genuinely has no space there.
    const first = rendered.get('1')!;
    expect(first).toContain('>4</span>-<span class="mono">9</span>');
    expect(text(first)).toContain('Bramble Warden');
    // Fixed-size (min = max = 1): just the one number, never "1-1".
    const second = rendered.get('2')!;
    expect(text(second)).toContain('1 Bramble Warden Elder');
    expect(second).not.toContain('</span>-<span');
  });

  it('shows the unit-size points as a spaced block below the model lines, using the label verbatim', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);

    const sizeRows = rows(html, 'cost');
    expect(text(sizeRows.get('5-1')!)).toContain('5 models (70 pts)');
    // The tier's own label already says "third copy onward" - no separate copy-index column.
    expect(text(sizeRows.get('5-3')!)).toContain('5 models, third copy onward (65 pts)');
    expect(text(sizeRows.get('10-1')!)).toContain('10 models (140 pts)');
  });

  it('shows a composition-only unit with model and size lines together, and no wargear section', async () => {
    const html = await enrichedPage(CHOIR_ECHO);

    expect(attrValues(html, 'composition')).toEqual(['1']);
    expect(text(rows(html, 'composition').get('1')!)).toContain('3 Choir Echo');
    expect(text(rows(html, 'cost').get('3-1')!)).toContain('3 models (45 pts)');

    expect(attrValues(html, 'wargear')).toEqual([]);
    expect(attrValues(html, 'option-choice')).toEqual([]);
    expect(text(html)).not.toContain(strings.headings.wargearOptions);
  });

  it('still shows the composition section, with no model line, for a unit with cost data but no composition rows', async () => {
    const html = await enrichedPage(WITHERSTALK_RELIC);

    // The section is keyed on EITHER composition or size data existing, not composition alone -
    // otherwise every unit that predates composition extraction would silently lose its points.
    expect(html).toContain('data-composition-section');
    expect(text(html)).toContain(strings.headings.composition);
    expect(attrValues(html, 'composition')).toEqual([]);

    const row = rows(html, 'cost').get('1-1')!;
    expect(text(row)).toContain('1 model (180 pts)');
    expect(row).toContain('flag--unverified');
    expect(text(html)).toContain(strings.labels.unverifiedPricingNote);
  });
});

describe('Wargear options as a sentence per group (FR-006, FR-007, US1 scenario 2)', () => {
  it('reads "For every N models..." for a per_n_models group, then a dash list of every choice', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);

    expect(html).toContain('data-wargear-options');
    expect(html).toContain('data-option-group="og-bramble-warden-1"');
    expect(html).toContain('data-option-group-scope="per_n_models"');
    expect(attrValues(html, 'option-scope-n')).toContain('5');
    expect(text(html)).toContain(strings.prose.perNModelsPrefix);
    expect(text(html)).toContain(strings.prose.perNModelsSuffix);

    expect(attrValues(html, 'option-choice')).toEqual(
      expect.arrayContaining(['oc-bramble-warden-1-1', 'oc-bramble-warden-1-2', 'oc-bramble-warden-1-3']),
    );

    const thornlance = rows(html, 'option-choice').get('oc-bramble-warden-1-1')!;
    expect(text(thornlance)).toContain('1 Thornlance');
    expect(thornlance).toContain('data-option-points="5"');
    expect(text(thornlance)).toContain('(+5 pts)');
  });

  it('reads "This unit can take one of the following:" for a multiple-choice unit-scope group', async () => {
    const html = await enrichedPage(LATTICE_DRONE);

    expect(html).toContain('data-option-group-scope="unit"');
    expect(text(html)).toContain(strings.prose.unitMultiplePrefix);
    expect(html).not.toContain('data-option-scope-n');

    const pulseArray = rows(html, 'option-choice').get('oc-lattice-drone-1-1')!;
    expect(text(pulseArray)).toContain('Pulse Array');
    expect(pulseArray).toContain('data-flag="default"');
    expect(pulseArray).not.toContain('data-option-points');

    const heavyBeamer = rows(html, 'option-choice').get('oc-lattice-drone-1-2')!;
    expect(text(heavyBeamer)).toContain('1 Heavy Beamer');
    expect(text(heavyBeamer)).toContain('(+15 pts)');
  });

  it('folds a single unit-scope choice into one sentence, with no one-item dash list', async () => {
    const html = await enrichedPage(LATTICE_DRONE);

    expect(html).toContain('data-option-group="og-lattice-drone-2"');
    const identBeacon = rows(html, 'option-choice').get('oc-lattice-drone-2-1')!;
    expect(text(identBeacon)).toContain('1 Ident Beacon');
    expect(text(identBeacon)).toContain('(+10 pts)');

    // The whole group's content is one sentence: prefix, the choice, a full stop - not a heading
    // sentence followed by a redundant single <li>.
    const group = rows(html, 'option-group').get('og-lattice-drone-2')!;
    expect(group).not.toContain('wargear-choice-list');
    expect(text(group)).toContain(strings.prose.unitSinglePrefix);
  });

  it('lists an unpriced choice without a cost figure, never as free (FR-007)', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const standard = rows(html, 'option-choice').get('oc-bramble-warden-1-2')!;

    expect(text(standard)).toContain('1 Bramble Standard');
    expect(standard).not.toContain('data-option-points');
    expect(text(standard)).not.toContain('pts');
  });

  it('marks an explicit "no change" choice as selectable, not as a free addition (Edge Cases)', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const noChange = rows(html, 'option-choice').get('oc-bramble-warden-1-3')!;

    expect(text(noChange)).toContain('No change');
    // No `count` field on this choice in the fixture - never a fabricated leading number.
    expect(text(noChange)).not.toMatch(/^\s*\d/);
    expect(noChange).toContain('data-flag="no-change"');
    expect(text(noChange)).toContain(strings.flags.noChange);
    expect(noChange).toContain('data-flag="default"');
    expect(noChange).not.toContain('data-option-points');
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

describe('Partial wargear coverage note (wargearOptionState)', () => {
  it('shows the note for a datasheet whose wargear extraction is only partial', async () => {
    const html = await enrichedPage(LATTICE_DRONE);
    const datasheet = bundle.datasheets.find((d) => d.id === 'ds-lattice-drone')!;
    expect(datasheet.wargearOptionState).toBe('partial');

    expect(html).toContain('data-wargear-partial-note');
    expect(text(html)).toContain(strings.notes.wargearPartial);
  });

  it('shows no note for a datasheet whose wargear extraction is complete', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const datasheet = bundle.datasheets.find((d) => d.id === 'ds-bramble-warden')!;
    expect(datasheet.wargearOptionState).toBe('full');

    expect(html).not.toContain('data-wargear-partial-note');
    expect(text(html)).not.toContain(strings.notes.wargearPartial);
  });

  it('shows no note for a datasheet with no wargearOptionState at all (older-bundle / fallback case)', async () => {
    const html = await enrichedPage(SWIFTWING_SCOUT);
    const datasheet = bundle.datasheets.find((d) => d.id === 'ds-swiftwing-scout')!;
    expect(datasheet.wargearOptionState).toBeUndefined();

    expect(html).not.toContain('data-wargear-partial-note');
  });
});
