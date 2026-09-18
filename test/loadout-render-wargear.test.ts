// AI-Assisted: Claude Code (model: Claude Sonnet 5) - Failing-first receipt for carrying
// wargearAbilityId from the bundle through to the itemName segment as metadata only (Task 1 of
// the wargear-abilities feature). Proves the id lands on the itemName slot and nowhere else, and
// that its presence changes no canonical string and no Segment.text.
import { describe, expect, it } from 'vitest';
import { renderOptionsBlock, renderCompositionBlock } from '../src/data/loadout-render.ts';

const OPTION_INPUT = {
  optionGroups: [{
    id: 'og-x-1', line: 1, scope: 'unit',
    choices: [{ id: 'oc-x-1-1', items: [
      { role: 'granted', itemIndex: 1, itemName: 'Hover Limpet', wargearAbilityId: 'wga-verdant-concord-hover-limpet' },
    ] }],
  }],
};

describe('wargear ability ids ride the itemName segment as metadata', () => {
  it('attaches the id to the itemName slot and nowhere else', () => {
    const result = renderOptionsBlock(OPTION_INPUT);
    const tagged = result.segments.filter((s) => s.wargearAbilityId !== undefined);
    expect(tagged).toHaveLength(1);
    expect(tagged[0]).toMatchObject({ kind: 'slot', slot: 'itemName', text: 'Hover Limpet', wargearAbilityId: 'wga-verdant-concord-hover-limpet' });
  });

  it('leaves canonical and the concatenation identity untouched', () => {
    const withId = renderOptionsBlock(OPTION_INPUT);
    const without = renderOptionsBlock({ optionGroups: [{ ...OPTION_INPUT.optionGroups[0], choices: [{ id: 'oc-x-1-1', items: [{ role: 'granted', itemIndex: 1, itemName: 'Hover Limpet' }] }] }] });
    expect(withId.canonical).toBe(without.canonical);
    expect(withId.segments.map((s) => s.text).join('')).toBe(withId.canonical);
  });

  it('composition equipment items carry it too', () => {
    const result = renderCompositionBlock({
      composition: [{ line: 1, modelName: 'Warden', minCount: 5, maxCount: 5 }],
      equipmentGroups: [{ id: 'eq-x-1', line: 1, appliesTo: 'unit', items: [{ itemIndex: 1, itemName: 'Hover Limpet', wargearAbilityId: 'wga-verdant-concord-hover-limpet' }] }],
    });
    expect(result.segments.some((s) => s.slot === 'itemName' && s.wargearAbilityId === 'wga-verdant-concord-hover-limpet')).toBe(true);
  });
});
