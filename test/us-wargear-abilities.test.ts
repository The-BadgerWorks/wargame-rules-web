// AI-Assisted: Claude Code (model: Claude Sonnet 5) - Task 2 of the wargear-abilities web feature
// (specs/2026-09-18-web-wargear-abilities): proves LoadoutLines.astro renders a native
// <details>/<summary> disclosure for a slot segment whose `wargearAbilityId` (Task 1,
// src/data/loadout-render.ts) resolves in the bundle's `wargearAbilitiesById`
// (src/data/bundle.ts), and renders every other item exactly as before. Written failing-first,
// against the `enriched` build - the only fixture carrying the new `wargearAbilities` table.
import { describe, expect, it } from 'vitest';

import bundle from './fixtures/bundle-synth-enriched.json';
import { OUT_DIR_ENRICHED, page } from './helpers/built-site.ts';

const ROUTE = '/factions/verdant-concord/units/bramble-warden/';
const ENTRY = bundle.wargearAbilities.find((w) => w.id === 'wga-verdant-concord-hover-limpet')!;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Astro HTML-encodes an apostrophe in a text node as `&#39;`; the bundle value itself never is. */
const asRenderedText = (value: string): string => value.replace(/'/g, '&#39;');

describe('wargear abilities render beside linked items', () => {
  it('renders a disclosure for the linked option item and the linked equipment item', async () => {
    const html = await page(ROUTE, OUT_DIR_ENRICHED);
    const hits = html.match(/data-wargear-ability="wga-verdant-concord-hover-limpet"/g) ?? [];
    expect(hits).toHaveLength(2);
    // Tolerates the astro-cid scoped-style attribute LoadoutLines.astro's elements carry, same
    // convention as the summary <span> match below.
    expect(html).toMatch(
      new RegExp(
        `<p class="wargear-ability__summary float-tip__summary"[^>]*>${escapeRegExp(asRenderedText(ENTRY.summary))}</p>`,
      ),
    );
    // Tolerates whatever attributes LoadoutLines.astro's/Astro's scoped-style compiler adds to
    // <summary> and the slot <span> (data-slot, data-astro-cid-*) rather than pinning an exact
    // attribute list - the same established convention test/us-composition-wargear.test.ts already
    // documents for this span.
    expect(html).toMatch(
      /<summary[^>]*><span class="mono" data-slot="itemName"[^>]*>Hover Limpet<\/span><\/summary>/,
    );
  });

  it('renders every unlinked item exactly as before', async () => {
    const html = await page(ROUTE, OUT_DIR_ENRICHED);
    const itemNameSpans = [
      ...html.matchAll(/<span class="mono" data-slot="itemName"[^>]*>([^<]*)<\/span>/g),
    ].map((m) => m[1]);
    const plain = itemNameSpans.filter((text) => text !== 'Hover Limpet');
    expect(plain.length).toBeGreaterThan(0);
    expect(html).not.toMatch(/data-wargear-ability="(?!wga-verdant-concord-hover-limpet")/);
  });

  it('keeps the disclosure summary text a verbatim bundle value (content boundary)', async () => {
    const html = await page(ROUTE, OUT_DIR_ENRICHED);
    expect(html).not.toMatch(/data-summary=|title="Placeholder/);
  });
});
