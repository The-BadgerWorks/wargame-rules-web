// AI-Assisted: Claude Code (model: Claude Sonnet 5) - Keyword glossary resolution
// (005-rules-web-enrichment-display task T013; spec.md FR-010, FR-012).
//
// normalizeKeywordKey() implements bundle-schema-delta.md v1.1.0 §4's five-step procedure
// EXACTLY, because both the producer and this site must derive the identical key from the
// identical input or a glossary lookup silently fails to resolve (contract §4: "This document is
// the single source of truth for it"). This module does not invent a second normalization scheme:
// a `keywordGlossary` row's own `keywordKey` is already normalised by the producer; what this file
// adds is deriving that SAME key from the raw keyword text the site is about to RENDER (a unit
// keyword, or one comma-split token of a weapon's `abilityKeywords`), since usage sites carry no
// precomputed key of their own.
//
// Casefold (step 2) is approximated with `toLowerCase()` rather than `toLocaleLowerCase()`: the
// latter's behaviour depends on the running environment's default locale (Turkish dotless-i being
// the classic trap), which would make the SAME input normalise to different keys on different
// machines - the opposite of what a "single source of truth" normalisation requires.
// `toLowerCase()` uses the locale-invariant Unicode default case mapping.
import { keywordGlossaryByKey, type KeywordGlossaryEntry } from './bundle.ts';

export interface NormalizedKeyword {
  key: string;
  hasNumericParameter: boolean;
}

/** A trailing run of digits, preceded by a space, at the very end of the string (contract §4 step 5). */
const TRAILING_NUMERIC_PARAMETER = / (\d+)$/;

/** Any character that is not a Unicode letter, a Unicode number, or a plain space (step 3). */
const NON_ALPHANUMERIC_NON_SPACE = /[^\p{L}\p{N} ]/gu;

/**
 * bundle-schema-delta.md v1.1.0 §4, verbatim:
 *   1. Unicode NFKC
 *   2. casefold
 *   3. replace every non-alphanumeric, non-space character with a space
 *   4. collapse runs of whitespace to a single space, and trim
 *   5. if the result ends in a run of digits preceded by a space, remove that run and set
 *      hasNumericParameter = true
 *
 * Step 1 MUST run before step 5: a compatibility-decomposable digit (e.g. superscript "²") is not
 * `\d` until NFKC has rewritten it to an ASCII digit, so ordering here is not incidental.
 */
export function normalizeKeywordKey(raw: string): NormalizedKeyword {
  const nfkc = raw.normalize('NFKC');
  const casefolded = nfkc.toLowerCase();
  const alnumOrSpace = casefolded.replace(NON_ALPHANUMERIC_NON_SPACE, ' ');
  const collapsed = alnumOrSpace.replace(/\s+/g, ' ').trim();

  const trailingDigits = TRAILING_NUMERIC_PARAMETER.exec(collapsed);
  if (trailingDigits) {
    return { key: collapsed.slice(0, trailingDigits.index), hasNumericParameter: true };
  }
  return { key: collapsed, hasNumericParameter: false };
}

/**
 * Resolves a rendered keyword string to its glossary entry, or `undefined` when the glossary
 * carries none for it (FR-012: the site introduces no fallback and no additional normalization of
 * its own). `glossary` defaults to the live bundle's index but accepts an override so this function
 * is testable against a synthetic map independent of whichever bundle a test run happens to load
 * (test/glossary-key.test.ts).
 */
export function resolveGlossary(
  displayText: string,
  glossary: ReadonlyMap<string, KeywordGlossaryEntry> = keywordGlossaryByKey,
): KeywordGlossaryEntry | undefined {
  return glossary.get(normalizeKeywordKey(displayText).key);
}
