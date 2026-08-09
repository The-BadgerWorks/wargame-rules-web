// AI-Assisted: Claude Code (model: Claude Sonnet 5) - Army-rule lineage resolution
// (005-rules-web-enrichment-display task T021; spec.md FR-015 through FR-017; US3 clarification
// 2026-08-09: "Inherit - display the parent faction's army rule when the sub-faction's bundle
// entry carries none of its own", with nearest-in-lineage winning outright over a more distant
// ancestor's rule).
//
// Walks faction -> parentFactionOf(faction) -> ... (reusing bundle.ts's existing sub-faction
// machinery rather than re-deriving lineage) and returns the first faction in that chain whose OWN
// bundle entry carries any `factionRules` rows. A sub-faction with a rule of its own never sees its
// parent's rule merged in alongside it (Edge Cases: "the sub-faction's own rule governs its pages
// ... the parent's is not shown alongside it") - this function stops at the first match, it does
// not accumulate rows across the walk.
import { factionRulesByFaction, parentFactionOf, type Faction, type FactionRule } from './bundle.ts';

export interface GoverningArmyRule {
  /** The faction whose OWN bundle entry carries the resolved rule(s) - the faction passed in, or
   *  an ancestor of it when resolution walked up the lineage. */
  source: Faction;
  /** Every row bundle-schema-delta.md §2.5 carries for `source`, in `displayOrder` (a faction may
   *  publish more than one army rule). */
  rules: readonly FactionRule[];
}

/**
 * The army rule(s) governing `faction` for display purposes: its own, or the nearest ancestor's
 * when it has none of its own. `undefined` when no faction in the lineage - `faction` itself or
 * any parent - carries a rule (FR-017: no army-rule section anywhere in that lineage).
 */
export function resolveGoverningArmyRule(faction: Faction): GoverningArmyRule | undefined {
  let current: Faction | undefined = faction;
  while (current) {
    const rules = factionRulesByFaction.get(current.id);
    if (rules && rules.length > 0) {
      return { source: current, rules };
    }
    current = parentFactionOf(current);
  }
  return undefined;
}
