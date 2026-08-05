// AI-Assisted: Claude Code (model: claude-opus-5) - User Story 1's rendering test (task T020),
// written before src/pages/index.astro, src/pages/factions/[faction]/index.astro and
// src/pages/factions/[faction]/detachments/[detachment].astro exist, and confirmed failing first.
//
// AI-Assisted note (model: claude-sonnet-5, PO review finding 2026-08-05): rewrote the "parent
// faction" index assertion into a sub-faction-nesting assertion, and added the faction-page
// sub-factions-section coverage, for the Space Marines "Chapters" grouping change.
//
// Evidence for FR-003, FR-004, FR-005, FR-006, spec US1 acceptance scenarios 1-5, and the Edge
// Cases for an empty faction and for a sub-faction.
//
// It asserts against the HTML of a real `astro build` over the synthetic fixtures
// (test/helpers/built-site.ts), so "every faction has a page" and "this link resolves to a page
// that was actually generated" are provable here rather than deferred to the post-build script.
import { describe, expect, it } from 'vitest';

import strings from '../src/chrome-strings.json';
import bundle from './fixtures/bundle-synth.json';
import { attrValues, hrefs, linkTexts, page, pageExists, rows, text } from './helpers/built-site.ts';

const FACTION_INDEX = '/';
const VERDANT_CONCORD = '/factions/verdant-concord/';
const VERDANT_OUTRIDERS = '/factions/verdant-outriders/';
const HOLLOW_CHOIR = '/factions/hollow-choir/';
const IRON_TESSELLATE = '/factions/iron-tessellate/';
const TANGLE_VANGUARD = '/factions/verdant-concord/detachments/tangle-vanguard/';
const THORN_LEGACY = '/factions/verdant-concord/detachments/thorn-legacy/';
const LATTICE_PHALANX = '/factions/iron-tessellate/detachments/lattice-phalanx/';

/** Every restriction vocabulary term FR-005 forbids showing in place of the authored message. */
const RESTRICTION_TYPES = [...new Set(bundle.detachmentRestrictions.map((r) => r.restrictionType))];

describe('Faction index (FR-003, US1 scenario 1)', () => {
  it('lists every faction in the bundle by name, each linking to its own page', async () => {
    const html = await page(FACTION_INDEX);

    expect(attrValues(html, 'faction').sort()).toEqual(
      bundle.factions.map((f) => f.code).sort(),
    );

    for (const faction of bundle.factions) {
      expect(linkTexts(html, `/factions/${faction.code}/`)).toContain(faction.name);
    }
  });

  // PO review finding (2026-08-05): a sub-faction is no longer a top-level entry on the index - it
  // nests under its parent's card instead, under a group heading whose label chrome-strings.json
  // supplies (the generic default here, since the fixture's parent faction code carries no
  // override; the live "space-marines" override to "Chapters" is a separate concern of
  // src/data/sub-factions.ts, not of this synthetic fixture).
  it('nests a sub-faction under its parent card instead of listing it at the top level', async () => {
    const html = await page(FACTION_INDEX);

    // Only a faction with no parent gets its own top-level card.
    const topLevelCards = [...html.matchAll(/<li class="faction-card" data-faction="([^"]+)"/g)].map(
      (m) => m[1],
    );
    const expectedTopLevel = bundle.factions
      .filter((f) => !('parentFactionId' in f))
      .map((f) => f.code)
      .sort();
    expect(topLevelCards.sort()).toEqual(expectedTopLevel);
    expect(topLevelCards).not.toContain('verdant-outriders');

    // Verdant Outriders (the fixture's only sub-faction) is nested inside Verdant Concord's
    // sub-factions group, under the chrome-strings label, still linking to its own page.
    const groups = rows(html, 'sub-factions-parent');
    const group = groups.get('verdant-concord')!;
    expect(group).toContain('data-faction="verdant-outriders"');
    expect(text(group)).toContain(strings.headings.subFactions);
    expect(linkTexts(html, VERDANT_OUTRIDERS)).toContain('Verdant Outriders');

    // No sub-factions group renders for a faction with no children.
    expect(groups.has('hollow-choir')).toBe(false);
    expect(groups.has('iron-tessellate')).toBe(false);
  });

  it('generated a page for every faction it links to', async () => {
    const html = await page(FACTION_INDEX);
    const factionLinks = hrefs(html).filter((h) => h.startsWith('/factions/'));

    expect(factionLinks.length).toBeGreaterThanOrEqual(bundle.factions.length);
    for (const href of new Set(factionLinks)) {
      expect(await pageExists(href), `no page generated for ${href}`).toBe(true);
    }
  });
});

describe('Faction page (FR-004, US1 scenario 2)', () => {
  it("lists the faction's detachments and units, each linking to its own page", async () => {
    const html = await page(VERDANT_CONCORD);

    expect(text(html)).toContain('Verdant Concord');
    expect(attrValues(html, 'detachment').sort()).toEqual(['tangle-vanguard', 'thorn-legacy']);
    expect(attrValues(html, 'unit').sort()).toEqual([
      'bramble-warden',
      'seedpod-hauler',
      'thicket-matriarch',
      'witherstalk-relic',
    ]);

    expect(linkTexts(html, TANGLE_VANGUARD)).toContain('Tangle Vanguard');
    expect(linkTexts(html, THORN_LEGACY)).toContain('Thorn Legacy');
    expect(linkTexts(html, `${VERDANT_CONCORD}units/bramble-warden/`)).toContain('Bramble Warden');
    expect(linkTexts(html, `${VERDANT_CONCORD}units/witherstalk-relic/`)).toContain(
      'Witherstalk Relic',
    );

    // US1 owns the faction and detachment pages, so their links are checked to resolve here. The
    // unit pages are User Story 2's deliverable (FR-007), so this story asserts only that the unit
    // links it renders address the routes D1 defines; test/us2-unit-datacard.test.ts asserts those
    // pages exist. That split is what keeps the two stories independently testable.
    const links = new Set(hrefs(html).filter((h) => h.startsWith('/factions/')));
    for (const href of links) {
      if (href.includes('/units/')) {
        expect(href).toMatch(/^\/factions\/[a-z0-9-]+\/units\/[a-z0-9-]+\/$/);
        continue;
      }
      expect(await pageExists(href), `no page generated for ${href}`).toBe(true);
    }
  });

  it('includes a Legends unit in the list rather than hiding it (Edge Cases)', async () => {
    const html = await page(VERDANT_CONCORD);
    expect(attrValues(html, 'unit')).toContain('witherstalk-relic');
  });

  it(
    "lists its sub-factions above its detachments and units, under the chrome-strings label " +
      '(PO review finding, 2026-08-05)',
    async () => {
      const html = await page(VERDANT_CONCORD);

      expect(html).toContain('data-sub-factions');
      expect(html).toContain('data-sub-factions-parent="verdant-concord"');
      expect(linkTexts(html, VERDANT_OUTRIDERS)).toContain('Verdant Outriders');
      expect(text(html)).toContain(strings.headings.subFactions);

      // The section renders before Detachments and Units, not after.
      const subFactionsAt = html.indexOf('data-sub-factions-parent="verdant-concord"');
      const detachmentsAt = html.indexOf(strings.headings.detachments);
      const unitsAt = html.indexOf(strings.headings.units);
      expect(subFactionsAt).toBeGreaterThan(-1);
      expect(subFactionsAt).toBeLessThan(detachmentsAt);
      expect(subFactionsAt).toBeLessThan(unitsAt);
    },
  );

  it('renders no sub-factions section for a faction with no children', async () => {
    const html = await page(IRON_TESSELLATE);
    expect(html).not.toContain('data-sub-factions');
  });

  it("shows a sub-faction's own detachments and units only, plus a link to its parent", async () => {
    const html = await page(VERDANT_OUTRIDERS);

    // research D1: the sub-faction page does NOT absorb its parent's units, and the parent page
    // does not absorb the child's.
    expect(attrValues(html, 'detachment')).toEqual(['swiftwing-raid']);
    expect(attrValues(html, 'unit')).toEqual(['swiftwing-scout']);

    expect(linkTexts(html, VERDANT_CONCORD)).toContain('Verdant Concord');
    expect(text(html)).toContain(strings.headings.parentFaction);

    const parent = await page(VERDANT_CONCORD);
    expect(attrValues(parent, 'unit')).not.toContain('swiftwing-scout');
    expect(attrValues(parent, 'detachment')).not.toContain('swiftwing-raid');
  });

  it('says so when a faction has no detachments, rather than showing an empty section', async () => {
    const html = await page(HOLLOW_CHOIR);

    expect(attrValues(html, 'detachment')).toEqual([]);
    expect(attrValues(html, 'empty')).toContain('detachments');
    expect(text(html)).toContain(strings.empty.detachments);

    // The units it does have are unaffected.
    expect(attrValues(html, 'unit')).toEqual(['choir-echo']);
    expect(text(html)).not.toContain(strings.empty.units);
  });
});

describe('Detachment page (FR-005, US1 scenario 3)', () => {
  it('shows the name, DP cost and non-Legends status', async () => {
    const html = await page(TANGLE_VANGUARD);

    expect(text(html)).toContain('Tangle Vanguard');
    expect(attrValues(html, 'detachment-points')).toEqual(['3']);
    expect(text(html)).toContain(strings.labels.detachmentPointsCost);
    expect(attrValues(html, 'flag')).not.toContain('legends');
  });

  it('marks a Legends detachment as Legends', async () => {
    const html = await page(THORN_LEGACY);

    expect(attrValues(html, 'detachment-points')).toEqual(['2']);
    expect(attrValues(html, 'flag')).toContain('legends');
    expect(text(html)).toContain(strings.flags.legends);
  });

  it("renders each restriction's authored message, never its internal rule type", async () => {
    const html = await page(TANGLE_VANGUARD);
    const own = bundle.detachmentRestrictions.filter((r) => r.detachmentId === 'd-tangle-vanguard');
    expect(own.length).toBeGreaterThan(0);

    expect(attrValues(html, 'restriction').sort()).toEqual(own.map((r) => r.id).sort());
    for (const restriction of own) {
      expect(text(html)).toContain(restriction.messageTemplate);
    }

    // FR-005 is explicit that the internal type and its parameters are not what a reader sees.
    for (const type of RESTRICTION_TYPES) {
      expect(text(html)).not.toContain(type);
    }
    expect(text(html)).not.toContain('paramsJson');
    expect(text(html)).not.toContain('"keyword"');
  });

  it('says no restrictions are recorded when the bundle attaches none', async () => {
    // The live bundle has zero detachmentRestrictions rows (research §0), so this is the ordinary
    // path at launch, not a fallback.
    const html = await page(THORN_LEGACY);

    expect(attrValues(html, 'restriction')).toEqual([]);
    expect(attrValues(html, 'empty')).toContain('restrictions');
    expect(text(html)).toContain(strings.empty.restrictions);
  });
});

describe('Enhancements on a detachment page (FR-006, US1 scenarios 4 and 5)', () => {
  it('shows every enhancement with its name, points and max copies per army', async () => {
    const html = await page(TANGLE_VANGUARD);
    const granted = bundle.enhancements.filter((e) => e.detachmentId === 'd-tangle-vanguard');

    expect(attrValues(html, 'enhancement').sort()).toEqual(granted.map((e) => e.id).sort());

    const listed = rows(html, 'enhancement');
    for (const enhancement of granted) {
      const row = listed.get(enhancement.id)!;
      expect(text(row)).toContain(enhancement.name);
      expect(row).toContain(`data-enhancement-points="${enhancement.points}"`);
      expect(row).toContain(`data-enhancement-max="${enhancement.maxPerArmy}"`);
    }

    expect(text(html)).toContain(strings.labels.points);
    expect(text(html)).toContain(strings.labels.maxPerArmy);
  });

  it('shows the eligibility rule the data defines for an enhancement', async () => {
    const html = await page(LATTICE_PHALANX);
    const rules = bundle.enhancementEligibility.filter((e) => e.enhancementId === 'e-lattice-core');
    expect(rules.length).toBeGreaterThan(0);

    expect(attrValues(html, 'eligibility').sort()).toEqual(rules.map((r) => r.ruleType).sort());
    expect(text(html)).toContain(strings.eligibilityTypes.datasheet_allowlist);
    expect(text(html)).toContain(strings.eligibilityTypes.forbids_keyword);
    // A datasheet allowlist names the datasheet, not the raw identifier it is stored as.
    expect(text(html)).toContain('Lattice Drone');
    expect(text(html)).not.toContain('ds-lattice-drone');
    expect(text(html)).toContain('Vehicle');
  });

  it('says so when an enhancement has no eligibility rule recorded', async () => {
    // enhancementEligibility is empty in the live bundle (research §0).
    const html = await page(TANGLE_VANGUARD);
    const quickenedSap = rows(html, 'enhancement').get('e-quickened-sap')!;

    expect(quickenedSap).toContain('data-empty="eligibility"');
    expect(text(quickenedSap)).toContain(strings.empty.eligibility);
  });

  it('says so when a detachment grants no enhancements, rather than showing an empty section', async () => {
    const html = await page(THORN_LEGACY);

    expect(attrValues(html, 'enhancement')).toEqual([]);
    expect(attrValues(html, 'empty')).toContain('enhancements');
    expect(text(html)).toContain(strings.empty.enhancements);
  });
});

describe('US1 coverage: a page exists for every faction and every detachment', () => {
  it('generated one page per faction', async () => {
    for (const faction of bundle.factions) {
      expect(await pageExists(`/factions/${faction.code}/`), faction.code).toBe(true);
    }
  });

  it('generated one page per detachment, under its own faction', async () => {
    const factionCodeById = new Map(bundle.factions.map((f) => [f.id, f.code]));
    for (const detachment of bundle.detachments) {
      const route = `/factions/${factionCodeById.get(detachment.factionId)}/detachments/${detachment.id.slice(2)}/`;
      expect(await pageExists(route), route).toBe(true);
    }
  });

  it('carries the shared layout, and therefore the banner and the disclaimer, on each of them', async () => {
    for (const route of [FACTION_INDEX, IRON_TESSELLATE, TANGLE_VANGUARD]) {
      const html = await page(route);
      expect(html).toContain('data-version-banner');
      expect(html).toContain('data-disclaimer');
    }
  });
});
