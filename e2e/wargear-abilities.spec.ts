// AI-Assisted: Claude Code (model: claude-sonnet-5) - e2e hover coverage for the wargear-ability
// disclosure introduced alongside KeywordTag's shared FloatTip (wargear-abilities branch, Task 3).
//
// Mirrors e2e/keyword-glossary.spec.ts's proven hover pattern (same fixture page, same
// `.hover()` + boundingBox() cursor-anchoring approach, same webServer/config) rather than
// inventing a new one: the two disclosures share the same `data-float-tip` mount and
// `.keyword-float-tip` floating element, so the interaction contract under test is identical -
// only the source attribute (`data-wargear-ability` vs `data-keyword-glossary`) and the fixture
// entry differ.
//
// The expected summary text is read from the fixture at runtime (never hard-coded here) so this
// spec stays correct if the fixture's wording changes without anyone touching this file.
import { expect, test } from '@playwright/test';

import bundle from '../test/fixtures/bundle-synth-enriched.json' with { type: 'json' };

const BRAMBLE_WARDEN = '/factions/verdant-concord/units/bramble-warden/';
const HOVER_LIMPET_ID = 'wga-verdant-concord-hover-limpet';

const HOVER_LIMPET_SUMMARY = bundle.wargearAbilities.find((ability) => ability.id === HOVER_LIMPET_ID)!.summary;

test.describe('Wargear-ability disclosure tooltip (JavaScript enabled)', () => {
  test('shows the floating preview with the fixture summary on hover, and Escape closes the disclosure', async ({
    page,
  }) => {
    await page.goto(BRAMBLE_WARDEN);
    const tip = page.locator('.keyword-float-tip');
    await expect(tip).toBeHidden();

    // The fixture's Hover Limpet appears twice on this page (once in the unit's default
    // equipment, once as a granted option choice) - both render the same disclosure markup via
    // the same LoadoutLines.astro branch, so both are asserted rather than narrowing to one with
    // `.first()`, which would only ever exercise one of the two rendering paths.
    const occurrences = page.locator(`[data-wargear-ability="${HOVER_LIMPET_ID}"]`);
    await expect(occurrences).toHaveCount(2);

    for (let i = 0; i < 2; i += 1) {
      const details = occurrences.nth(i);
      const summary = details.locator('summary');
      const summaryText = details.locator('p.wargear-ability__summary');

      // `.wargear-ability { display: inline }` (site.css) overrides <details>'s own display,
      // which is exactly the kind of override that can defeat the UA's default hiding of
      // non-<summary> children while closed. The built-HTML tests can't see this - the <p> is
      // present in the markup regardless of CSS - so this is the one assertion that actually
      // exercises the CSS rule rather than just the markup. If it regresses, the ability summary
      // renders permanently inline inside every wargear sentence on every live page that links
      // an item, not just here.
      await expect(summaryText).toBeHidden();

      // `.hover()` scrolls the target into view before moving the pointer, same as the glossary spec.
      await summary.hover();
      await expect(tip).toBeVisible();
      await expect(tip).toHaveText(HOVER_LIMPET_SUMMARY);

      // Escape closes the disclosure once it is open via keyboard, same contract as the glossary
      // spec's keyboard case: focus it, open it, then confirm Escape closes it again.
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(details).toHaveAttribute('open', '');

      await page.keyboard.press('Escape');
      await expect(details).not.toHaveAttribute('open', '');
      // Same closed-state assertion as above, now after a genuine open/close cycle rather than on
      // first load - confirms the UA re-hides the sibling <p> once the disclosure is closed again.
      await expect(summaryText).toBeHidden();
    }
  });
});
