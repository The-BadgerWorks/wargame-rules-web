// AI-Assisted: Claude Code (model: claude-opus-5) - Research D1 slug derivation with the build-time
// uniqueness and charset assertions (task T012).
//
// D1's argument in one line: 002 FR-014 already guarantees entity ids are stable across rules
// versions, so URL stability is INHERITED rather than re-engineered here. There is no slugify
// function, no collision table, and no second identifier space to keep in sync - a slug is the id
// minus its type prefix, and nothing else. What this module adds is the pair of assertions that
// make that inheritance safe: a slug outside the URL charset, or a collision within a type, fails
// the build rather than silently overwriting a page.

/** The only characters a generated URL segment may contain. */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

const DETACHMENT_PREFIX = 'd-';
const DATASHEET_PREFIX = 'ds-';

function assertCharset(kind: string, value: string, source: string): string {
  if (!SLUG_PATTERN.test(value)) {
    throw new Error(
      `${kind} slug "${value}" derived from "${source}" is outside the URL charset ` +
        `${SLUG_PATTERN.source}. Refusing to build.`,
    );
  }
  return value;
}

function strip(kind: string, id: string, prefix: string): string {
  if (typeof id !== 'string' || !id.startsWith(prefix)) {
    throw new Error(`${kind} id "${id}" does not carry the expected "${prefix}" prefix.`);
  }
  return assertCharset(kind, id.slice(prefix.length), id);
}

/**
 * A faction's URL segment is its `code` verbatim (D1). Passing it through this function rather
 * than reading `.code` at the call site is what puts every faction code under the same charset
 * assertion as the derived slugs.
 */
export function factionCode(code: string): string {
  if (typeof code !== 'string') {
    throw new Error(`Faction code ${String(code)} is not a string.`);
  }
  return assertCharset('faction', code, code);
}

/** `detachments[].id` minus its leading `d-`. */
export function detachSlug(detachmentId: string): string {
  // `ds-` also begins with `d`, but not with `d-`, so the two prefixes cannot be confused.
  return strip('detachment', detachmentId, DETACHMENT_PREFIX);
}

/** `datasheets[].id` minus its leading `ds-`. */
export function unitSlug(datasheetId: string): string {
  return strip('unit', datasheetId, DATASHEET_PREFIX);
}

/**
 * Prefix stripping is a bijection within each entity type only while the ids it is applied to are
 * unique. This asserts that premise at build time instead of trusting it.
 */
export function assertUniqueSlugs(kind: string, slugs: readonly string[]): void {
  const seen = new Set<string>();
  const collisions = new Set<string>();

  for (const slug of slugs) {
    if (seen.has(slug)) collisions.add(slug);
    seen.add(slug);
  }

  if (collisions.size > 0) {
    throw new Error(
      `${kind} slugs are not unique: ${[...collisions].sort().join(', ')}. ` +
        `Two entities would render to the same URL. Refusing to build.`,
    );
  }
}
