// AI-Assisted: Claude Code (model: Claude Sonnet 5) - Conformance proof for the site's own
// implementation of rendering-contract.md v1.0.0 (loadout-rendering-conformance branch).
//
// This is the headline evidence FR-014 asks for: "two independent implementations produce
// byte-identical output for the same input", proven here against the SAME vendored, synthetic
// corpus the pipeline's own reference renderer conforms to
// (test/fixtures/rendering-conformance/cases.json + expected.json, copied verbatim from
// WargameCompanion/specs/007-loadout-display-fidelity/contracts/rendering-fixtures/). This site's
// src/data/loadout-render.ts was written from the contract's text alone - never read against or
// copied from the pipeline's `pipeline/render/loadout.py` - so agreement here is the real proof,
// not a foregone conclusion.
//
// Every one of the 19 cases is asserted individually (not looped-and-summarised) so a single
// regression names its own case id in the failure output, and no case is skipped or normalised
// before comparison (contract §8.2: "output byte-identical to expected.json").
import { describe, expect, it } from 'vitest';

import casesFile from './fixtures/rendering-conformance/cases.json';
import expectedFile from './fixtures/rendering-conformance/expected.json';
import { renderCompositionBlock, renderOptionsBlock, type LoadoutInput } from '../src/data/loadout-render.ts';

interface Case {
  id: string;
  block: 'composition' | 'options';
  input: LoadoutInput;
}

interface Expected {
  id: string;
  canonical: string;
  omitted: string[];
}

const cases = casesFile.cases as unknown as Case[];
const expectedById = new Map((expectedFile.cases as unknown as Expected[]).map((e) => [e.id, e]));

describe('rendering-contract.md v1.0.0 conformance corpus', () => {
  it('vendored fixture covers exactly 19 cases at contract version 1.0.0', () => {
    expect(casesFile.contractVersion).toBe('1.0.0');
    expect(expectedFile.contractVersion).toBe('1.0.0');
    expect(cases.length).toBe(19);
    expect(expectedById.size).toBe(19);
  });

  for (const testCase of cases) {
    it(`${testCase.id}: canonical string is byte-identical to expected.json`, () => {
      const expected = expectedById.get(testCase.id);
      expect(expected, `no expected.json entry for case "${testCase.id}"`).toBeDefined();

      const result =
        testCase.block === 'composition'
          ? renderCompositionBlock(testCase.input)
          : renderOptionsBlock(testCase.input);

      expect(result.canonical).toBe(expected!.canonical);
      expect(new Set(result.omitted)).toEqual(new Set(expected!.omitted));
      expect(result.omitted.length).toBe(expected!.omitted.length);

      // §7.2's concatenation identity: every segment's text, joined in order, must equal the
      // canonical string exactly - checked as its own assertion, not inferred from the string
      // check above, since a renderer could get `canonical` right via a separate code path while
      // its segment stream (what a styling UI actually consumes) silently drifted.
      const fromSegments = result.segments.map((segment) => segment.text).join('');
      expect(fromSegments).toBe(result.canonical);
    });
  }
});
