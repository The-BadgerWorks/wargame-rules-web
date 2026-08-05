// AI-Assisted: Claude Code (model: claude-sonnet-5) - The sub-faction group-heading label (PO
// review finding, 2026-08-05): the faction index and a faction's own page both group a faction's
// sub-factions under a heading rather than listing them as top-level entries. That heading is
// authored prose, so it lives in chrome-strings.json alongside everything else this site renders
// - but "Chapters" is Space Marines-specific terminology, while the bundle's parent/child relation
// (`factions[].parentFactionId`) is generic. Rather than hard-code "Chapters" anywhere, the generic
// default (`headings.subFactions`) can be overridden per parent, keyed on that parent's own bundle
// `code` (`subFactionLabelOverrides` in chrome-strings.json). Today the map holds exactly one entry
// - "space-marines" -> "Chapters" - but the mechanism itself names no faction.
import strings from '../chrome-strings.json';
import type { Faction } from './bundle.ts';
import { factionCode } from './slugs.ts';

const OVERRIDES: Readonly<Record<string, string>> = strings.subFactionLabelOverrides;

/** The group-heading label for `parent`'s sub-factions. */
export function subFactionsLabelFor(parent: Faction): string {
  return OVERRIDES[factionCode(parent.code)] ?? strings.headings.subFactions;
}
