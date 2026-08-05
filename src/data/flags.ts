// AI-Assisted: Claude Code (model: claude-opus-5) - The category-flag vocabulary (task T034;
// FR-015, FR-017).
//
// FR-015 requires the badges on unit listings and on the unit's own page; FR-017 requires the same
// categories to be selectable in the filter. That is three consumers - FlagBadges.astro, the
// faction page's unit rows, and UnitFilter.astro - and if any two of them derived the key set
// independently, a filter option could exist that no row ever carries, or a badge could exist that
// no option selects. So the mapping from the datasheet's boolean columns to a URL-safe key and to
// its authored label lives here, once, and every consumer reads it.
//
// The keys are internal identifiers, never rendered: `stringKey` names the chrome-strings.json
// entry that is. Ordering is the order badges and filter options appear in.
import type { Datasheet } from './bundle.ts';

/** The chrome-strings.json keys under `flags`. Kept literal so a typo is a type error. */
export type FlagStringKey =
  | 'battleline'
  | 'character'
  | 'epicHero'
  | 'dedicatedTransport'
  | 'legends';

export interface UnitFlag {
  /** The value carried in `data-flags` and in the filter's option values. Never rendered. */
  key: string;
  /** The chrome-strings.json key whose value IS rendered. */
  stringKey: FlagStringKey;
  on: (datasheet: Datasheet) => boolean;
}

export const UNIT_FLAGS: readonly UnitFlag[] = Object.freeze([
  { key: 'battleline', stringKey: 'battleline', on: (d) => d.isBattleline },
  { key: 'character', stringKey: 'character', on: (d) => d.isCharacter },
  { key: 'epic-hero', stringKey: 'epicHero', on: (d) => d.isEpicHero },
  { key: 'dedicated-transport', stringKey: 'dedicatedTransport', on: (d) => d.isDedicatedTransport },
  { key: 'legends', stringKey: 'legends', on: (d) => d.isLegends },
] satisfies UnitFlag[]);

/** The flags a datasheet carries, in vocabulary order. */
export function flagsOf(datasheet: Datasheet): readonly UnitFlag[] {
  return UNIT_FLAGS.filter((flag) => flag.on(datasheet));
}

/**
 * The `data-flags` attribute value: a space-separated key list, which is what lets the filter test
 * membership with a plain `split(' ').includes(...)` and no parsing (research D5).
 */
export function flagAttribute(datasheet: Datasheet): string {
  return flagsOf(datasheet)
    .map((flag) => flag.key)
    .join(' ');
}

/**
 * The `data-search` attribute value: everything the text filter matches against, lowercased once at
 * build time so the browser never lowercases 218 rows per keystroke.
 */
export function searchAttribute(datasheet: Datasheet): string {
  return `${datasheet.name} ${datasheet.role ?? ''}`.trim().toLowerCase();
}
