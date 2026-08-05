// AI-Assisted: Claude Code (model: claude-opus-5) - User Story 2's rendering test (task T026),
// written before src/pages/factions/[faction]/units/[unit].astro and the five datacard components
// exist, and confirmed failing first.
//
// Evidence for FR-007 through FR-015 and spec US2 acceptance scenarios 1-8.
//
// US2's Independent Test is "open any unit's page directly by its own URL, without having navigated
// through a faction or detachment page first". A static build satisfies that by construction - each
// assertion below reads one page's HTML in isolation, with no navigation and no shared state - so
// this file deliberately never loads a faction page except where FR-015 requires the badge to
// appear on a listing too.
import { describe, expect, it } from 'vitest';

import strings from '../src/chrome-strings.json';
import bundle from './fixtures/bundle-synth.json';
import { attrValues, countAttr, linkTexts, page, pageExists, rows, text } from './helpers/built-site.ts';

const BRAMBLE_WARDEN = '/factions/verdant-concord/units/bramble-warden/';
const THICKET_MATRIARCH = '/factions/verdant-concord/units/thicket-matriarch/';
const WITHERSTALK_RELIC = '/factions/verdant-concord/units/witherstalk-relic/';
const SEEDPOD_HAULER = '/factions/verdant-concord/units/seedpod-hauler/';
const LATTICE_DRONE = '/factions/iron-tessellate/units/lattice-drone/';
const CHOIR_ECHO = '/factions/hollow-choir/units/choir-echo/';
const VERDANT_CONCORD = '/factions/verdant-concord/';

function forDatasheet<T extends { datasheetId: string }>(rowsIn: readonly T[], id: string): T[] {
  return rowsIn.filter((row) => row.datasheetId === id);
}

describe('Unit page coverage (FR-007)', () => {
  it('generated one page per datasheet, under its own faction', async () => {
    const factionCodeById = new Map(bundle.factions.map((f) => [f.id, f.code]));
    for (const datasheet of bundle.datasheets) {
      const route = `/factions/${factionCodeById.get(datasheet.factionId)}/units/${datasheet.id.slice(3)}/`;
      expect(await pageExists(route), route).toBe(true);
    }
  });

  it('names the unit and carries the shared layout on a directly opened page', async () => {
    const html = await page(WITHERSTALK_RELIC);

    expect(text(html)).toContain('Witherstalk Relic');
    expect(html).toContain('data-version-banner');
    expect(html).toContain('data-disclaimer');
  });
});

describe('Model characteristics (FR-008, US2 scenario 1)', () => {
  it('shows every model line with M, T, Sv, W, Ld and OC', async () => {
    const html = await page(BRAMBLE_WARDEN);
    const models = forDatasheet(bundle.datasheetModels, 'ds-bramble-warden');
    expect(models.length).toBe(2);

    expect(attrValues(html, 'model')).toEqual(models.map((m) => String(m.line)));

    for (const stat of ['movement', 'toughness', 'save', 'wounds', 'leadership', 'objectiveControl']) {
      expect(attrValues(html, 'stat')).toContain(stat);
    }

    const rendered = rows(html, 'model');
    const first = rendered.get('1')!;
    expect(text(first)).toContain('Bramble Warden');
    expect(text(first)).toContain('6"');
    expect(text(first)).toContain('3+');
    // The second model line differs only in Wounds, so a page that rendered one line twice, or
    // rendered the same line for both, fails here.
    expect(text(rendered.get('2')!)).toContain('Bramble Warden Elder');
    expect(attrValues(html, 'model').length).toBe(2);
  });

  it('shows an invulnerable save where the datasheet has one', async () => {
    const html = await page(THICKET_MATRIARCH);

    expect(attrValues(html, 'stat')).toContain('invulnSave');
    expect(text(html)).toContain(strings.labels.invulnSave);
    expect(text(rows(html, 'model').get('1')!)).toContain('4+');
  });

  it('omits the invulnerable-save column entirely when no model has one (Edge Cases)', async () => {
    const html = await page(BRAMBLE_WARDEN);

    expect(attrValues(html, 'stat')).not.toContain('invulnSave');
    expect(html).not.toContain('data-stat="invulnSave"');
  });
});

describe('Weapon profiles (FR-009, US2 scenario 2)', () => {
  it('shows every ranged and melee profile with its statistics and ability keywords', async () => {
    const html = await page(BRAMBLE_WARDEN);
    const weapons = forDatasheet(bundle.datasheetWeapons, 'ds-bramble-warden');

    expect(attrValues(html, 'weapon').sort()).toEqual(weapons.map((w) => String(w.line)).sort());
    expect(text(html)).toContain(strings.headings.rangedWeapons);
    expect(text(html)).toContain(strings.headings.meleeWeapons);

    const rendered = rows(html, 'weapon');

    const carbine = rendered.get('1')!;
    expect(carbine).toContain('data-weapon-kind="ranged"');
    expect(text(carbine)).toContain('Sap Carbine');
    expect(text(carbine)).toContain('18"');
    expect(text(carbine)).toContain('assault');

    const thornlance = rendered.get('2')!;
    expect(thornlance).toContain('data-weapon-kind="melee"');
    expect(text(thornlance)).toContain('Thornlance');
    expect(text(thornlance)).toContain('-1');
  });

  it('omits the ranged section for a unit with only melee profiles', async () => {
    const html = await page(SEEDPOD_HAULER);

    expect(attrValues(html, 'weapon-kind')).toEqual(['melee']);
    expect(text(html)).toContain(strings.headings.meleeWeapons);
    expect(text(html)).not.toContain(strings.headings.rangedWeapons);
  });

  it('omits the melee section for a unit with only ranged profiles', async () => {
    const html = await page(LATTICE_DRONE);

    expect(attrValues(html, 'weapon-kind')).toEqual(['ranged']);
    expect(text(html)).toContain(strings.headings.rangedWeapons);
    expect(text(html)).not.toContain(strings.headings.meleeWeapons);
  });

  it('carries ability keywords only, never a rules-text field the bundle does not define', async () => {
    const html = await page(WITHERSTALK_RELIC);
    const array = rows(html, 'weapon').get('1')!;

    expect(text(array)).toContain('blast');
    expect(text(array)).toContain('heavy');
    // The bundle has no weapon rules-text column at all; asserting the field name never appears
    // catches a template that invented one.
    expect(html).not.toContain('rulesText');
    expect(html).not.toContain('description');
  });
});

describe('Abilities and keywords (FR-010, US2 scenario 3)', () => {
  it('shows every ability by name with its mechanics-only summary and its type', async () => {
    const html = await page(THICKET_MATRIARCH);
    const abilities = forDatasheet(bundle.datasheetAbilities, 'ds-thicket-matriarch');
    expect(abilities.length).toBe(2);

    expect(countAttr(html, 'ability')).toBe(abilities.length);

    const rendered = text(html);
    for (const ability of abilities) {
      expect(rendered).toContain(ability.name);
      // The summary is reproduced verbatim from the bundle: it is the upstream-authored,
      // mechanics-only text, and paraphrasing it here would be a Principle 4 violation.
      expect(rendered).toContain(ability.summary);
    }

    expect(attrValues(html, 'ability-type').sort()).toEqual(
      abilities.map((a) => a.abilityType).sort(),
    );
    expect(rendered).toContain(strings.abilityTypes.core);
  });

  it("shows the unit's keywords", async () => {
    const html = await page(THICKET_MATRIARCH);
    const keywords = bundle.datasheetKeywords.filter(
      (k) => k.datasheetId === 'ds-thicket-matriarch',
    );

    expect(text(html)).toContain(strings.headings.keywords);
    expect(countAttr(html, 'keyword')).toBe(keywords.length);
    for (const keyword of keywords) {
      expect(text(html)).toContain(keyword.keyword);
    }
  });
});

describe('Points (FR-012, FR-014, US2 scenarios 5 and 7)', () => {
  it('shows the points for every published model count', async () => {
    const html = await page(BRAMBLE_WARDEN);

    expect(text(html)).toContain(strings.headings.points);
    expect(attrValues(html, 'cost')).toContain('5-1');
    expect(attrValues(html, 'cost')).toContain('10-1');

    const rendered = rows(html, 'cost');
    expect(rendered.get('5-1')!).toContain('data-cost-points="70"');
    expect(rendered.get('10-1')!).toContain('data-cost-points="140"');
  });

  it('shows an escalating cost for repeated copies as its own row', async () => {
    const html = await page(BRAMBLE_WARDEN);

    expect(attrValues(html, 'cost')).toContain('5-3');
    const escalating = rows(html, 'cost').get('5-3')!;
    expect(escalating).toContain('data-cost-points="65"');
    expect(escalating).toContain('data-cost-from="3"');
    expect(text(html)).toContain(strings.labels.copyIndexMin);
  });

  it('visibly marks an unverified cost row rather than presenting it as a verified one', async () => {
    const unverified = await page(WITHERSTALK_RELIC);

    expect(attrValues(unverified, 'cost-confidence')).toContain('unverified');
    expect(text(unverified)).toContain(strings.labels.unverifiedPricing);
    expect(text(unverified)).toContain(strings.labels.unverifiedPricingNote);

    // A verified row must not carry the same mark, or the mark says nothing.
    const verified = await page(CHOIR_ECHO);
    expect(attrValues(verified, 'cost-confidence')).toEqual(['verified']);
    expect(text(verified)).not.toContain(strings.labels.unverifiedPricing);
  });
});

describe('Wargear options (FR-011, US2 scenario 4)', () => {
  it('shows each cost-bearing option with its point delta', async () => {
    const html = await page(BRAMBLE_WARDEN);
    const options = forDatasheet(bundle.datasheetWargearOptions, 'ds-bramble-warden');
    expect(options.length).toBe(1);

    expect(text(html)).toContain(strings.headings.wargearOptions);
    expect(attrValues(html, 'wargear')).toEqual(options.map((o) => o.id));

    const row = rows(html, 'wargear').get('wg-bramble-thornlance')!;
    expect(text(row)).toContain('Thornlance');
    expect(row).toContain('data-wargear-delta="5"');
  });

  it('shows no wargear section at all for a unit with no cost-bearing options', async () => {
    const html = await page(CHOIR_ECHO);

    expect(attrValues(html, 'wargear')).toEqual([]);
    expect(text(html)).not.toContain(strings.headings.wargearOptions);
  });
});

describe('Leader pairing (FR-013, US2 scenario 6)', () => {
  it('lists the units a Character is permitted to lead, each linking to its page', async () => {
    const html = await page(THICKET_MATRIARCH);

    expect(text(html)).toContain(strings.headings.leads);
    expect(attrValues(html, 'leads')).toEqual(['bramble-warden']);
    expect(linkTexts(html, BRAMBLE_WARDEN)).toContain('Bramble Warden');
  });

  it('shows no leader-pairing section for a unit that is not a Character', async () => {
    const html = await page(BRAMBLE_WARDEN);

    expect(attrValues(html, 'leads')).toEqual([]);
    expect(text(html)).not.toContain(strings.headings.leads);
  });
});

describe('Category flags (FR-015, US2 scenario 8)', () => {
  it("marks the unit's categories on its own page", async () => {
    expect(attrValues(await page(BRAMBLE_WARDEN), 'flag')).toEqual(['battleline']);
    expect(attrValues(await page(THICKET_MATRIARCH), 'flag').sort()).toEqual([
      'character',
      'epic-hero',
    ]);
    expect(attrValues(await page(SEEDPOD_HAULER), 'flag')).toEqual(['dedicated-transport']);
    expect(attrValues(await page(WITHERSTALK_RELIC), 'flag')).toEqual(['legends']);
    expect(attrValues(await page(CHOIR_ECHO), 'flag')).toEqual([]);
  });

  it('uses the authored flag names rather than a field name', async () => {
    const html = await page(THICKET_MATRIARCH);

    expect(text(html)).toContain(strings.flags.character);
    expect(text(html)).toContain(strings.flags.epicHero);
    expect(html).not.toContain('isEpicHero');
  });

  it('marks the same categories on the faction page unit listing', async () => {
    const html = await page(VERDANT_CONCORD);
    const listed = rows(html, 'unit');

    expect(listed.get('bramble-warden')!).toContain('data-flag="battleline"');
    expect(listed.get('bramble-warden')!).not.toContain('data-flag="legends"');
    expect(listed.get('thicket-matriarch')!).toContain('data-flag="character"');
    expect(listed.get('thicket-matriarch')!).toContain('data-flag="epic-hero"');
    // A Legends unit is labelled in the listing, not hidden from it (Edge Cases).
    expect(listed.get('witherstalk-relic')!).toContain('data-flag="legends"');
  });
});
