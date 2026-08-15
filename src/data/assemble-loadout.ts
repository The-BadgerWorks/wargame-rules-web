// AI-Assisted: Claude Code (model: Claude Sonnet 5) - The one-way translation from this site's
// bundle indexes (src/data/bundle.ts) into the nested `LoadoutInput` shape
// src/data/loadout-render.ts expects - the same shape rendering-contract.md's conformance corpus
// ships in cases.json (contract §8.1), so the renderer itself never depends on the bundle's flat
// array layout at all. This module is the ONLY place that joins the bundle's FK-linked arrays
// (`datasheetOptionGroups` -> `datasheetOptionChoices` -> `datasheetOptionChoiceItems`, and
// `datasheetEquipmentGroups` -> `datasheetEquipmentItems`) into the nested shape; the renderer
// stays a pure function of already-assembled input, provable against the vendored corpus with no
// bundle in scope at all (see test/rendering-conformance.test.ts).
//
// Two entry points, matching the two Astro components that each need only half of this: the Unit
// Composition block reads composition + equipment; the Wargear Options block reads option groups +
// item constraints. Neither assembler reads the other's arrays.
import {
  compositionsByDatasheet,
  equipmentGroupsByDatasheet,
  equipmentItemsByGroup,
  itemConstraintsByDatasheet,
  optionChoiceItemsByChoice,
  optionChoicesByGroup,
  optionGroupsByDatasheet,
} from './bundle.ts';
import type {
  LoadoutCompositionLine,
  LoadoutEquipmentGroup,
  LoadoutInput,
  LoadoutItemConstraint,
  LoadoutOptionChoice,
  LoadoutOptionGroup,
} from './loadout-render.ts';

/** The Unit Composition block's input: composition rows plus the equipment groups attached to
 *  this datasheet (rendering-contract.md §3.2, §3.3). */
export function assembleCompositionInput(datasheetId: string): LoadoutInput {
  const composition: LoadoutCompositionLine[] = (compositionsByDatasheet.get(datasheetId) ?? []).map(
    (line) => ({ line: line.line, modelName: line.modelName, minCount: line.minCount, maxCount: line.maxCount }),
  );

  const equipmentGroups: LoadoutEquipmentGroup[] = (equipmentGroupsByDatasheet.get(datasheetId) ?? []).map(
    (group) => ({
      id: group.id,
      line: group.line,
      appliesTo: group.appliesTo,
      modelName: group.modelName,
      items: (equipmentItemsByGroup.get(group.id) ?? []).map((item) => ({
        itemIndex: item.itemIndex,
        itemName: item.itemName,
        count: item.count,
        weaponLine: item.weaponLine,
      })),
    }),
  );

  return { composition, equipmentGroups };
}

/** The Wargear Options block's input: option groups (with their choices and items) plus the item
 *  constraints attached to this datasheet (rendering-contract.md §3.4, §3.5). */
export function assembleOptionsInput(datasheetId: string): LoadoutInput {
  const optionGroups: LoadoutOptionGroup[] = (optionGroupsByDatasheet.get(datasheetId) ?? []).map((group) => ({
    id: group.id,
    line: group.line,
    scope: group.scope,
    scopeN: group.scopeN,
    parentGroupId: group.parentGroupId,
    eligibleModelName: group.eligibleModelName,
    eligibleMaxCount: group.eligibleMaxCount,
    isPerModel: group.isPerModel,
    maxChoices: group.maxChoices,
    choices: (optionChoicesByGroup.get(group.id) ?? []).map(
      (choice): LoadoutOptionChoice => ({
        id: choice.id,
        isNoChange: choice.isNoChange,
        items: (optionChoiceItemsByChoice.get(choice.id) ?? []).map((item) => ({
          role: item.role,
          itemIndex: item.itemIndex,
          itemName: item.itemName,
          count: item.count,
          weaponLine: item.weaponLine,
        })),
      }),
    ),
  }));

  const itemConstraints: LoadoutItemConstraint[] = (itemConstraintsByDatasheet.get(datasheetId) ?? []).map(
    (constraint) => ({
      constraintIndex: constraint.constraintIndex,
      constraintType: constraint.constraintType,
      itemName: constraint.itemName,
      modelName: constraint.modelName,
      weaponLine: constraint.weaponLine,
    }),
  );

  return { optionGroups, itemConstraints };
}
