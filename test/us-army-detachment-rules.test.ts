// AI-Assisted: Claude Code (model: Claude Sonnet 5) - User Story 3 and User Story 4's rendering
// tests (005-rules-web-enrichment-display tasks T025 and T027), written after army-rule.ts,
// RuleSummary.astro, and its integration into the faction and detachment pages.
//
// Evidence for spec.md FR-015 through FR-019, US3 acceptance scenarios 1-3, and US4 acceptance
// scenarios 1-2, including the 2026-08-09 clarification that a sub-faction with no army rule of
// its own inherits the nearest one in its parent lineage.
import { describe, expect, it } from 'vitest';

import strings from '../src/chrome-strings.json';
import bundle from './fixtures/bundle-synth-enriched.json';
import { attrValues, OUT_DIR_ENRICHED, page, rows, text } from './helpers/built-site.ts';

const VERDANT_CONCORD = '/factions/verdant-concord/';
const VERDANT_OUTRIDERS = '/factions/verdant-outriders/';
const HOLLOW_CHOIR = '/factions/hollow-choir/';
const IRON_TESSELLATE_FACTION = '/factions/iron-tessellate/';
const TANGLE_VANGUARD = '/factions/verdant-concord/detachments/tangle-vanguard/';
const THORN_LEGACY = '/factions/verdant-concord/detachments/thorn-legacy/';
const SWIFTWING_RAID = '/factions/verdant-outriders/detachments/swiftwing-raid/';
const LATTICE_PHALANX = '/factions/iron-tessellate/detachments/lattice-phalanx/';

const enrichedPage = (route: string) => page(route, OUT_DIR_ENRICHED);

function factionRule(id: string) {
  const rule = bundle.factionRules.find((r) => r.id === id);
  if (!rule) throw new Error(`Fixture has no factionRules row "${id}".`);
  return rule;
}

function detachmentRule(id: string) {
  const rule = bundle.detachmentRules.find((r) => r.id === id);
  if (!rule) throw new Error(`Fixture has no detachmentRules row "${id}".`);
  return rule;
}

describe('Army rule on the faction page (FR-015, US3 scenario 1)', () => {
  it("shows the faction's own army rule name and summary", async () => {
    const html = await enrichedPage(VERDANT_CONCORD);
    const verdantAccord = factionRule('fr-verdant-concord-1');

    expect(attrValues(html, 'rule-section')).toContain('army-rule');
    expect(text(html)).toContain(strings.headings.armyRule);

    const row = rows(html, 'rule').get('fr-verdant-concord-1')!;
    expect(text(row)).toContain(verdantAccord.name);
    expect(text(row)).toContain(verdantAccord.summary);
  });
});

describe('Army rule on the detachment page (FR-016, US3 scenario 2)', () => {
  it('shows the same governing army rule as its faction page, without navigating there first', async () => {
    const html = await enrichedPage(TANGLE_VANGUARD);
    const verdantAccord = factionRule('fr-verdant-concord-1');

    const row = rows(html, 'rule').get('fr-verdant-concord-1')!;
    expect(text(row)).toContain(verdantAccord.name);
    expect(text(row)).toContain(verdantAccord.summary);
  });
});

describe('Sub-faction lineage inheritance (US3 scenario 3, 2026-08-09 clarification)', () => {
  it("shows the parent's army rule on a sub-faction's own page when it has none of its own", async () => {
    const html = await enrichedPage(VERDANT_OUTRIDERS);
    const verdantAccord = factionRule('fr-verdant-concord-1');

    const row = rows(html, 'rule').get('fr-verdant-concord-1')!;
    expect(text(row)).toContain(verdantAccord.name);
    expect(text(row)).toContain(verdantAccord.summary);
  });

  it("shows the same inherited rule on the sub-faction's own detachment page", async () => {
    const html = await enrichedPage(SWIFTWING_RAID);
    const verdantAccord = factionRule('fr-verdant-concord-1');

    const row = rows(html, 'rule').get('fr-verdant-concord-1')!;
    expect(text(row)).toContain(verdantAccord.name);
    expect(text(row)).toContain(verdantAccord.summary);
  });
});

describe('No army rule anywhere in the lineage (FR-017, US3 scenario 4)', () => {
  it('shows no army-rule section on a faction page whose lineage carries no rule', async () => {
    const html = await enrichedPage(HOLLOW_CHOIR);

    expect(attrValues(html, 'rule-section')).not.toContain('army-rule');
    expect(text(html)).not.toContain(strings.headings.armyRule);
  });
});

describe("A faction's own direct rule (not inherited)", () => {
  it("shows Iron Tessellate's own army rule on both its faction and detachment pages", async () => {
    const latticeProtocol = factionRule('fr-iron-tessellate-1');

    const factionHtml = await enrichedPage(IRON_TESSELLATE_FACTION);
    expect(text(rows(factionHtml, 'rule').get('fr-iron-tessellate-1')!)).toContain(
      latticeProtocol.summary,
    );

    const detachmentHtml = await enrichedPage(LATTICE_PHALANX);
    expect(text(rows(detachmentHtml, 'rule').get('fr-iron-tessellate-1')!)).toContain(
      latticeProtocol.summary,
    );
  });
});

describe('Detachment rule alongside restrictions and enhancements (FR-018, US4 scenario 1)', () => {
  it("shows the detachment's own rule without replacing its restrictions or enhancements", async () => {
    const html = await enrichedPage(TANGLE_VANGUARD);
    const brambleWall = detachmentRule('dtr-tangle-vanguard');

    expect(attrValues(html, 'rule-section')).toContain('detachment-rule');
    expect(text(html)).toContain(strings.headings.detachmentRule);

    const row = rows(html, 'rule').get('dtr-tangle-vanguard')!;
    expect(text(row)).toContain(brambleWall.name);
    expect(text(row)).toContain(brambleWall.summary);

    // Restrictions and enhancements (US1's sections) are unaffected by the new one.
    expect(text(html)).toContain(strings.headings.restrictions);
    expect(text(html)).toContain(strings.headings.enhancements);
    expect(attrValues(html, 'restriction').length).toBeGreaterThan(0);
    expect(attrValues(html, 'enhancement').length).toBeGreaterThan(0);
  });

  it("shows Lattice Phalanx's own detachment rule too", async () => {
    const html = await enrichedPage(LATTICE_PHALANX);
    const ironFormation = detachmentRule('dtr-lattice-phalanx');

    const row = rows(html, 'rule').get('dtr-lattice-phalanx')!;
    expect(text(row)).toContain(ironFormation.name);
    expect(text(row)).toContain(ironFormation.summary);
  });
});

describe('No detachment rule recorded (FR-019, US4 scenario 2)', () => {
  it('shows no detachment-rule section while restrictions and enhancements render unaffected', async () => {
    const html = await enrichedPage(THORN_LEGACY);

    expect(attrValues(html, 'rule-section')).not.toContain('detachment-rule');
    expect(text(html)).not.toContain(strings.headings.detachmentRule);

    // Thorn Legacy already has no restrictions or enhancements recorded (research §0's ordinary
    // case) - both empty-states still render exactly as before this feature.
    expect(attrValues(html, 'restriction')).toEqual([]);
    expect(text(html)).toContain(strings.empty.restrictions);
    expect(attrValues(html, 'enhancement')).toEqual([]);
    expect(text(html)).toContain(strings.empty.enhancements);
  });
});
