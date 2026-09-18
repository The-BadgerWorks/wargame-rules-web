// AI-Assisted: Claude Code (model: Claude Sonnet 5) - User Story 1's rendering test
// (005-rules-web-enrichment-display task T012), written after UnitComposition.astro,
// WargearOptions.astro, the CostTable.astro fallback rework, and the unit page integration.
//
// AI-Assisted note (model: Claude Sonnet 5, loadout-rendering-conformance branch): rewritten for
// rendering-contract.md v1.0.0's Unit Composition and Wargear Options blocks
// (`renderCompositionBlock`/`renderOptionsBlock`, fed by `src/data/assemble-loadout.ts`), which
// fully replace the prose-composition-wargear branch's own ad-hoc sentence templates. This suite no
// longer asserts against `strings.prose.*` sentence fragments that branch invented (those keys are
// gone from chrome-strings.json); it asserts against the exact wording the contract's decision
// tables produce, which is already proven byte-identical against the vendored conformance corpus
// (test/rendering-conformance.test.ts) - this file's job is only to prove the DOM wiring, not the
// wording rules a second time. `data-composition-line`/`data-wargear-line` (LoadoutLines.astro) are
// generic per-block line indices, not per-entity keys like the old `data-composition`/
// `data-option-choice` markers were, since one contract-rendered line can carry a whole sentence
// spanning several bundle rows; tests below locate content by TEXT, using `rows()` only where a
// line index by itself is enough (e.g. "the first composition line").
//
// The unit-size points block (test/fixtures/bundle-synth-enriched.json's `datasheetCosts`/
// `datasheetCostTiers`) is untouched by the contract rework - it is this site's own addition, kept
// clearly after the composition block - so those assertions are unchanged from the prior branch.
//
// This suite asserts against the `enriched` build, the only fixture that carries composition,
// equipment-group, option-group, option-choice-item and item-constraint data. The pre-007 absence
// case is proven separately: test/us2-unit-datacard.test.ts already asserts the `current` build's
// unit pages show neither section, against a fixture that carries none of the new bundle arrays at
// all - `bundle.ts`'s `?? []` defaults mean `assembleCompositionInput`/`assembleOptionsInput`
// degrade to empty input there, and `renderCompositionBlock`/`renderOptionsBlock` are total
// functions over that (contract §5: omission never guesses, it just produces nothing to omit).
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

/**
 * `text()` replaces every HTML tag with a literal space before collapsing whitespace (built-
 * site.ts), so a slot `<span>` immediately followed by a literal "." or ";" (no space in the
 * source - every contract sentence ends flush against its slot) reads back with a space the
 * rendered page never actually shows. This undoes exactly that artifact so sentence-level
 * assertions below can compare against the contract's literal wording; it must never be used for
 * an adjacency claim itself (those stay on the raw HTML, as the codebase's established pattern for
 * "4-9" already does).
 */
function content(html: string): string {
  return text(html).replace(/ ([.;])/g, '$1');
}

describe('Unit composition lines, per rendering-contract.md §3.2/§4.1 (FR-004, FR-005, US1 scenarios 1 and 4)', () => {
  it('shows a ranged model line as "{min}-{max} {name}" and a fixed one as "{n} {name}"', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    const composition = bundle.datasheetCompositions.filter(
      (c) => c.datasheetId === 'ds-bramble-warden',
    );
    expect(composition.length).toBe(2);

    expect(html).toContain('data-composition-section');
    expect(text(html)).toContain(strings.headings.composition);

    const rendered = rows(html, 'composition-line');
    // Ranged (min 4, max 9): count-first, hyphenated range, no separate min/max labels. Checked
    // against the RAW fragment, not text(): text() replaces every tag with a space, so it cannot
    // represent "4-9" as adjacent characters even when the markup genuinely has no space there.
    // The regex tolerates whatever attributes LoadoutLines.astro's slot <span> carries (data-slot,
    // Astro's scoped-style data-astro-cid-*) rather than pinning an exact attribute list.
    const first = rendered.get('0')!;
    expect(first).toMatch(/>4<\/span>-<span[^>]*>9<\/span>/);
    expect(text(first)).toContain('Bramble Warden');
    // Fixed-size (min = max = 1): just the one number, never "1-1".
    const second = rendered.get('1')!;
    expect(text(second)).toContain('1 Bramble Warden Elder');
    expect(second).not.toContain('</span>-<span');
  });

  it('shows the unit-size points as a spaced block below the model lines, using the label verbatim', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);

    const sizeRows = rows(html, 'cost');
    // copyIndexMin 1 (the common case): the plain label, no qualifier - real bundle tier labels
    // never say which copy they start from in words, only `copyIndexMin` does (bugfix: an operator
    // report showed two "5 models" rows with different points and no way to tell them apart, once
    // this site stopped rendering a separate copy-index column).
    expect(text(sizeRows.get('5-1')!)).toContain('5 models (70 pts)');
    expect(text(sizeRows.get('5-1')!)).not.toContain('copy');
    // copyIndexMin > 1: the qualifier is appended by this site, not read from the label.
    expect(text(sizeRows.get('5-3')!)).toContain('5 models, copy 3 onwards (65 pts)');
    expect(text(sizeRows.get('10-1')!)).toContain('10 models (140 pts)');
  });

  it('still shows the composition section, with no model line, for a unit with cost data but no composition rows', async () => {
    const html = await enrichedPage(WITHERSTALK_RELIC);

    // The section is keyed on EITHER composition or size data existing, not composition alone -
    // otherwise every unit that predates composition extraction would silently lose its points.
    expect(html).toContain('data-composition-section');
    expect(text(html)).toContain(strings.headings.composition);
    expect(attrValues(html, 'composition-line')).toEqual([]);

    const row = rows(html, 'cost').get('1-1')!;
    expect(text(row)).toContain('1 model (180 pts)');
    expect(row).toContain('flag--unverified');
    expect(text(html)).toContain(strings.labels.unverifiedPricingNote);
  });
});

describe('Default equipment, per rendering-contract.md §3.3/§4.2 (spec 007)', () => {
  it('reads "Every model is equipped with: {item}." for a unit-scope equipment group', async () => {
    const html = await enrichedPage(CHOIR_ECHO);
    const datasheet = bundle.datasheets.find((d) => d.id === 'ds-choir-echo')!;
    expect(datasheet.defaultEquipmentState).toBe('extracted');

    // Composition and default equipment share one block/section - both appear here, and there is
    // still no separate wargear-options section (this unit has no option groups).
    expect(text(rows(html, 'composition-line').get('0')!)).toContain('3 Choir Echo');
    expect(text(html)).toContain(strings.loadout.equipmentUnitPrefix.trim());
    expect(text(html)).toContain('Echo Blade');
    expect(html).not.toContain('data-wargear-options');
  });

  it('reads "Every {model} is equipped with: {item}." for a model_group-scope equipment group', async () => {
    const html = await enrichedPage(SWIFTWING_SCOUT);

    // Not read via rows(): this is the unit's only composition-line row, so rows() (which slices
    // from one marker to the START OF THE NEXT) would run to the end of the whole document rather
    // than stopping at this row's own </li> - the same caveat built-site.ts documents for the last
    // row of any marker set.
    expect(content(html)).toContain('Every Swiftwing Scout is equipped with: Swift Javelin.');
  });
});

describe('Wargear options, per rendering-contract.md §3.4/§4.3/§4.4/§4.5 (FR-006, FR-007, US1 scenario 2)', () => {
  it('renders one full sentence per choice when a per_n_models group has no shared replaced set', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);

    expect(html).toContain('data-wargear-options');
    const wargearText = content(html);
    // §4.3's per_n_models subject, repeated as the sentence subject for every one of the group's
    // choices, since the fixture's three choices don't share one non-empty replaced set (§4.4's
    // row 6 fallback - no shared stem to factor out).
    expect(wargearText).toContain(
      'One model in this unit for every 5 models it contains can have Sap Carbine replaced with Thornlance.',
    );
    // The linked item's <details> disclosure carries its wargear-ability summary as a sibling of
    // <summary> (LoadoutLines.astro, wargear-abilities web feature Task 2), and native <details>
    // hides that sibling only visually when closed - the raw HTML (and this helper's text()) still
    // contains it inline. This is the one pinned string this rename touches beyond the name itself
    // (kickoff's named exception): the item that already carried the "Bramble Standard"/now
    // "Hover Limpet" name is the one Task 2 chose to link, so its sentence now reads on through the
    // disclosure's own summary text rather than stopping at the item name.
    expect(wargearText).toContain(
      "One model in this unit for every 5 models it contains can be equipped with Hover Limpet Placeholder: the bearer's unit ignores one placeholder modifier..",
    );
    expect(wargearText).toContain(
      'One model in this unit for every 5 models it contains can be left unchanged.',
    );
  });

  it('renders a shared stem plus a dash-list alternative per choice for an all-empty-replaced group', async () => {
    const html = await enrichedPage(LATTICE_DRONE);

    const wargearText = content(html);
    expect(wargearText).toContain('This unit can be equipped with one of the following:');
    expect(wargearText).toContain('- Pulse Array');
    expect(wargearText).toContain('- Heavy Beamer');
  });

  it('folds a single unit-scope choice into one full sentence, with no dash list', async () => {
    const html = await enrichedPage(LATTICE_DRONE);

    expect(content(html)).toContain('This unit can be equipped with Ident Beacon.');
    expect(html).not.toContain('- Ident Beacon');
  });
});

describe('Item constraints, per rendering-contract.md §3.5/§4.6 (spec 007)', () => {
  it('reads "{item} cannot be replaced." for a not_replaceable constraint with no modelName', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    expect(content(html)).toContain('Thornlance cannot be replaced.');
  });

  it('reads "Only one model in this unit can be equipped with {item}." for a one_per_unit constraint', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);
    expect(content(html)).toContain('Only one model in this unit can be equipped with Hover Limpet.');
  });
});

describe('Merged display supersedes the flat table (FR-008, US1 scenario 3, SC-002)', () => {
  it('does not also render the flat cost-only wargear table once the full structure is shown', async () => {
    const html = await enrichedPage(BRAMBLE_WARDEN);

    // The legacy flat option (wg-bramble-thornlance) exists in the bundle for this datasheet, but
    // must not render as its own table row once the merged display supersedes it (FR-008).
    expect(attrValues(html, 'wargear')).toEqual([]);
  });
});

describe('Flat-table fallback when no option groups are published (FR-009)', () => {
  it('falls back to the cost-bearing wargear table unchanged for a unit with no option groups', async () => {
    const html = await enrichedPage(SWIFTWING_SCOUT);
    const flat = bundle.datasheetWargearOptions.filter((o) => o.datasheetId === 'ds-swiftwing-scout');
    expect(flat.length).toBe(1);

    expect(attrValues(html, 'wargear')).toEqual(flat.map((o) => o.id));
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
