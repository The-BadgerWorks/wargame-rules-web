// AI-Assisted: Claude Code (model: Claude Sonnet 5) - The site's own, independently authored
// implementation of rendering-contract.md v1.0.0 (loadout-rendering-conformance branch). Written
// from the contract's text and template tables alone, never read against or copied from
// `wargame-rules-data`'s `pipeline/render/loadout.py` - FR-014's "two independent implementations
// produce byte-identical output" is only a real proof if this implementation is built from the
// contract alone and then checked against the vendored corpus
// (test/fixtures/rendering-conformance/), never against the other renderer's source or output.
//
// This module is a pure function: a `LoadoutInput` in, a canonical string and an optional segment
// stream out (contract §7). It touches no bundle.ts state and performs no I/O.
// `src/data/assemble-loadout.ts` is the separate, one-way translation from this site's bundle
// indexes into the `LoadoutInput` shape this file expects - the same nested shape the conformance
// corpus's `cases.json` ships (contract §8.1), so the conformance test needs no adapter between
// fixture and renderer.
//
// TypeScript strict, zero dependencies. Literal template text is read from chrome-strings.json's
// `loadout` section, one entry per template fragment named in the contract's §3 catalogue, so the
// same values back both this canonical string and (via `assemble-loadout.ts` and the two Astro
// components) whatever a page renders - byte-identity by construction, not by discipline.
import strings from '../chrome-strings.json';

// ---------------------------------------------------------------------------
// Input model (rendering-contract.md §2). Field names are the bundle's lowerCamelCase wire form;
// the nesting (items under a choice/group, choices under a group) is this module's own working
// shape, matching cases.json exactly - it is not the bundle's flat array layout.
// ---------------------------------------------------------------------------

export interface LoadoutCompositionLine {
  line: number;
  modelName?: string;
  minCount: number;
  maxCount: number;
}

export interface LoadoutItem {
  itemIndex: number;
  itemName: string;
  count?: number;
  weaponLine?: number;
  wargearAbilityId?: string;
}

export interface LoadoutEquipmentGroup {
  id: string;
  line: number;
  appliesTo: string;
  modelName?: string;
  items: readonly LoadoutItem[];
}

export interface LoadoutOptionChoiceItem extends LoadoutItem {
  role: string;
}

export interface LoadoutOptionChoice {
  id: string;
  isNoChange?: boolean;
  items: readonly LoadoutOptionChoiceItem[];
}

export interface LoadoutOptionGroup {
  id: string;
  line: number;
  scope: string;
  scopeN?: number;
  parentGroupId?: string;
  eligibleModelName?: string;
  eligibleMaxCount?: number;
  isPerModel?: boolean;
  maxChoices?: number;
  choices: readonly LoadoutOptionChoice[];
}

export interface LoadoutItemConstraint {
  constraintIndex: number;
  constraintType: string;
  itemName: string;
  modelName?: string;
  weaponLine?: number;
}

export interface LoadoutInput {
  composition?: readonly LoadoutCompositionLine[];
  equipmentGroups?: readonly LoadoutEquipmentGroup[];
  optionGroups?: readonly LoadoutOptionGroup[];
  itemConstraints?: readonly LoadoutItemConstraint[];
}

// ---------------------------------------------------------------------------
// Output (contract §7).
// ---------------------------------------------------------------------------

export type SegmentKind = 'literal' | 'slot';

export interface Segment {
  kind: SegmentKind;
  text: string;
  slot?: string;
  ref?: string | number;
  wargearAbilityId?: string;
}

export interface BlockResult {
  canonical: string;
  segments: Segment[];
  /**
   * The same content as `segments`, structured one array per rendered line (the "\n" separators
   * are implied by array boundaries, not repeated here). Not part of the contract - §7.2 only
   * requires the flat, concatenation-identical stream - but it is what a consumer needs to lay
   * lines out as list items rather than re-splitting `segments` on literal newlines.
   */
  lines: Segment[][];
  omitted: string[];
}

// ---------------------------------------------------------------------------
// Segment-building primitives. A "Line" is one rendered row's own segment list. Block assembly
// joins lines with a literal "\n" segment, so concatenating every segment of the whole result -
// including that separator - equals the canonical string exactly (§7.2's concatenation identity is
// therefore true by construction: both are read off the same segment list).
// ---------------------------------------------------------------------------

type Line = Segment[];

function lit(text: string): Segment {
  return { kind: 'literal', text };
}

function slotSeg(name: string, text: string, ref?: string | number, wargearAbilityId?: string): Segment {
  const base: Segment = ref === undefined ? { kind: 'slot', text, slot: name } : { kind: 'slot', text, slot: name, ref };
  return wargearAbilityId === undefined ? base : { ...base, wargearAbilityId };
}

/** E.item.counted / E.item.plain (§3.3), reused by §4.5 for a choice's items. The wargear ability
 *  id, when present, rides the itemName slot only - never the count slot (contract has no
 *  provision for it, this is site-local metadata for a later disclosure UI). */
function renderItem(item: LoadoutItem): Segment[] {
  if (item.count !== undefined) {
    return [
      slotSeg('count', String(item.count)),
      lit(' '),
      slotSeg('itemName', item.itemName, item.weaponLine, item.wargearAbilityId),
    ];
  }
  return [slotSeg('itemName', item.itemName, item.weaponLine, item.wargearAbilityId)];
}

/** L.join (§3.6): items joined by "; ", never a conjunction. */
function renderItemList(items: readonly LoadoutItem[]): Segment[] {
  const out: Segment[] = [];
  items.forEach((item, index) => {
    if (index > 0) out.push(lit(strings.loadout.listJoin));
    out.push(...renderItem(item));
  });
  return out;
}

function assemble(lines: readonly Line[]): Omit<BlockResult, 'omitted'> {
  const segments: Segment[] = [];
  lines.forEach((line, index) => {
    if (index > 0) segments.push(lit('\n'));
    segments.push(...line);
  });
  return { canonical: segments.map((s) => s.text).join(''), segments, lines: lines.map((line) => [...line]) };
}

interface RowResult {
  line?: Line;
  omitted?: string;
}

// ---------------------------------------------------------------------------
// Unit Composition block (§3.2, §3.3, §4.1, §4.2).
// ---------------------------------------------------------------------------

/** §4.1. */
function renderCompositionLine(row: LoadoutCompositionLine): RowResult {
  if (!row.modelName || row.modelName.length === 0) {
    return { omitted: 'RND-COMP-NO-NAME' };
  }
  if (row.minCount === row.maxCount) {
    return { line: [slotSeg('count', String(row.minCount)), lit(' '), slotSeg('modelName', row.modelName)] };
  }
  if (row.minCount < row.maxCount) {
    return {
      line: [
        slotSeg('minCount', String(row.minCount)),
        lit(strings.prose.rangeSeparator),
        slotSeg('maxCount', String(row.maxCount)),
        lit(' '),
        slotSeg('modelName', row.modelName),
      ],
    };
  }
  return { omitted: 'RND-COMP-BAD-RANGE' };
}

/** §4.2. */
function renderEquipmentGroup(group: LoadoutEquipmentGroup): RowResult {
  if (group.items.length === 0) {
    return { omitted: 'RND-EQP-NO-ITEMS' };
  }
  if (group.appliesTo === 'model_group') {
    if (!group.modelName) {
      return { omitted: 'RND-EQP-NO-SUBJECT' };
    }
    return {
      line: [
        lit(strings.loadout.equipmentModelPrefix),
        slotSeg('modelName', group.modelName),
        lit(strings.loadout.equipmentModelMiddle),
        ...renderItemList(group.items),
        lit(strings.prose.sentenceEnd),
      ],
    };
  }
  if (group.appliesTo === 'unit') {
    return {
      line: [lit(strings.loadout.equipmentUnitPrefix), ...renderItemList(group.items), lit(strings.prose.sentenceEnd)],
    };
  }
  return { omitted: 'RND-EQP-UNKNOWN-SCOPE' };
}

export function renderCompositionBlock(input: LoadoutInput): BlockResult {
  const lines: Line[] = [];
  const omitted: string[] = [];

  for (const row of [...(input.composition ?? [])].sort((a, b) => a.line - b.line)) {
    const result = renderCompositionLine(row);
    if (result.line) lines.push(result.line);
    else if (result.omitted) omitted.push(result.omitted);
  }

  for (const group of [...(input.equipmentGroups ?? [])].sort((a, b) => a.line - b.line)) {
    const result = renderEquipmentGroup(group);
    if (result.line) lines.push(result.line);
    else if (result.omitted) omitted.push(result.omitted);
  }

  const { canonical, segments, lines: assembledLines } = assemble(lines);
  return { canonical, segments, lines: assembledLines, omitted };
}

// ---------------------------------------------------------------------------
// Wargear Options block (§3.4, §3.5, §4.3, §4.4, §4.5, §4.6, §6's nesting rule).
// ---------------------------------------------------------------------------

interface SubjectResult {
  subject?: Line;
  omitted?: string;
}

/** §4.3. `eligibleModelName` is checked before `scope`, as the contract requires. */
function renderSubject(group: LoadoutOptionGroup): SubjectResult {
  if (group.eligibleModelName !== undefined && group.eligibleMaxCount !== undefined) {
    return {
      subject: [
        lit(strings.loadout.subjectUpToPrefix),
        slotSeg('eligibleMaxCount', String(group.eligibleMaxCount)),
        lit(' '),
        slotSeg('eligibleModelName', group.eligibleModelName),
        lit(strings.loadout.subjectInThisUnitSuffix),
      ],
    };
  }
  if (group.eligibleModelName !== undefined && group.isPerModel === true) {
    return {
      subject: [
        lit(strings.loadout.subjectEachPrefix),
        slotSeg('eligibleModelName', group.eligibleModelName),
        lit(strings.loadout.subjectInThisUnitSuffix),
      ],
    };
  }
  if (group.eligibleModelName !== undefined) {
    return {
      subject: [
        lit(strings.loadout.prefixThe),
        slotSeg('eligibleModelName', group.eligibleModelName),
        lit(strings.loadout.subjectInThisUnitSuffix),
      ],
    };
  }
  if (group.scope === 'per_n_models' && group.scopeN !== undefined) {
    return {
      subject: [
        lit(strings.loadout.subjectPerNModelsPrefix),
        slotSeg('scopeN', String(group.scopeN)),
        lit(strings.loadout.subjectPerNModelsSuffix),
      ],
    };
  }
  if (group.scope === 'per_n_models') {
    return { omitted: 'RND-OPT-NO-SCOPE-N' };
  }
  if (group.scope === 'model') {
    return { subject: [lit(strings.loadout.subjectEachModel)] };
  }
  if (group.scope === 'unit') {
    return { subject: [lit(strings.loadout.subjectUnit)] };
  }
  return { omitted: 'RND-OPT-UNKNOWN-SCOPE' };
}

type ChoiceKind = 'noChange' | 'replace' | 'grant' | 'remove';

interface ResolvedChoice {
  granted: readonly LoadoutOptionChoiceItem[];
  replaced: readonly LoadoutOptionChoiceItem[];
  kind: ChoiceKind;
}

/** §4.5. G = granted items in item_index order, P = replaced items in item_index order. */
function resolveChoice(choice: LoadoutOptionChoice): ResolvedChoice | { omitted: string } {
  const byIndex = (a: LoadoutItem, b: LoadoutItem) => a.itemIndex - b.itemIndex;
  const granted = choice.items.filter((i) => i.role === 'granted').slice().sort(byIndex);
  const replaced = choice.items.filter((i) => i.role === 'replaced').slice().sort(byIndex);

  if (choice.isNoChange === true) return { granted, replaced, kind: 'noChange' };
  if (granted.length > 0 && replaced.length > 0) return { granted, replaced, kind: 'replace' };
  if (granted.length > 0) return { granted, replaced, kind: 'grant' };
  if (replaced.length > 0) return { granted, replaced, kind: 'remove' };
  return { omitted: 'RND-OPT-NO-ITEMS' };
}

/** A choice rendered as its own full sentence (O.group.single and §4.4 row 6's fallback). */
function renderChoiceSentence(subject: Line, resolved: ResolvedChoice): Line {
  if (resolved.kind === 'noChange') {
    return [...subject, lit(strings.loadout.leftUnchangedSuffix)];
  }
  if (resolved.kind === 'replace') {
    return [
      ...subject,
      lit(strings.loadout.canHave),
      ...renderItemList(resolved.replaced),
      lit(strings.loadout.replacedWith),
      ...renderItemList(resolved.granted),
      lit(strings.prose.sentenceEnd),
    ];
  }
  if (resolved.kind === 'grant') {
    return [
      ...subject,
      lit(strings.loadout.canBeEquippedWith),
      ...renderItemList(resolved.granted),
      lit(strings.prose.sentenceEnd),
    ];
  }
  // 'remove'
  return [...subject, lit(strings.loadout.canHave), ...renderItemList(resolved.replaced), lit(strings.loadout.removedSuffix)];
}

/** An alternative line renders only what differs - the granted list, or "no change" (§3.4). */
function renderAlternativeLine(resolved: ResolvedChoice): Line {
  if (resolved.kind === 'noChange') return [lit(strings.loadout.alternativeNoChange)];
  return [lit(strings.loadout.alternativeLinePrefix), ...renderItemList(resolved.granted)];
}

/** Two choices share a replaced set when their role='replaced' rows are equal as an ordered
 *  sequence of (item_name, count) (§4.4). */
function replacedSetKey(items: readonly LoadoutOptionChoiceItem[]): string {
  return JSON.stringify(items.map((i) => [i.itemName, i.count ?? null]));
}

/** §4.4: the group's own lines (stem + alternatives, or one sentence, or several), given its
 *  resolved subject. Does not include nested children - the tree walk below attaches those. */
function renderOptionGroupOwnLines(group: LoadoutOptionGroup): { lines: Line[]; omitted: string[] } {
  const omitted: string[] = [];
  const subjectResult = renderSubject(group);
  if (subjectResult.omitted) return { lines: [], omitted: [subjectResult.omitted] };
  const subject = subjectResult.subject!;

  const choicesInOrder = [...group.choices].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const resolved: ResolvedChoice[] = [];
  for (const choice of choicesInOrder) {
    const r = resolveChoice(choice);
    if ('omitted' in r) omitted.push(r.omitted);
    else resolved.push(r);
  }

  if (resolved.length === 0) {
    omitted.push('RND-OPT-NO-CHOICES');
    return { lines: [], omitted };
  }
  if (resolved.length === 1) {
    return { lines: [renderChoiceSentence(subject, resolved[0]!)], omitted };
  }

  const maxChoicesAllowsSingle = group.maxChoices === undefined || group.maxChoices === 1;
  const allShareOneNonEmptyReplaced =
    resolved.every((r) => r.replaced.length > 0) &&
    new Set(resolved.map((r) => replacedSetKey(r.replaced))).size === 1;
  const allEmptyReplaced = resolved.every((r) => r.replaced.length === 0);

  if (allShareOneNonEmptyReplaced && maxChoicesAllowsSingle) {
    const stem: Line = [
      ...subject,
      lit(strings.loadout.canHave),
      ...renderItemList(resolved[0]!.replaced),
      lit(strings.loadout.replacedWithOneOfTheFollowing),
    ];
    return { lines: [stem, ...resolved.map(renderAlternativeLine)], omitted };
  }
  if (allEmptyReplaced && maxChoicesAllowsSingle) {
    const stem: Line = [...subject, lit(strings.loadout.equippedWithOneOfTheFollowing)];
    return { lines: [stem, ...resolved.map(renderAlternativeLine)], omitted };
  }
  if (allEmptyReplaced && group.maxChoices !== undefined && group.maxChoices > 1) {
    const stem: Line = [
      ...subject,
      lit(strings.loadout.equippedWithUpToPrefix),
      slotSeg('maxChoices', String(group.maxChoices)),
      lit(strings.loadout.ofTheFollowingSuffix),
    ];
    return { lines: [stem, ...resolved.map(renderAlternativeLine)], omitted };
  }

  // Row 6: the honest fallback - no shared stem to factor out.
  return { lines: resolved.map((r) => renderChoiceSentence(subject, r)), omitted };
}

/** A group is cyclic when walking its own parentGroupId chain leads back to itself. */
function detectCycles(groups: readonly LoadoutOptionGroup[]): Set<string> {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const cyclic = new Set<string>();
  for (const start of groups) {
    const visited = new Set<string>();
    let current: LoadoutOptionGroup | undefined = start;
    while (current?.parentGroupId !== undefined) {
      const parentId = current.parentGroupId;
      if (parentId === start.id) {
        cyclic.add(start.id);
        break;
      }
      if (visited.has(parentId)) break;
      visited.add(parentId);
      current = byId.get(parentId);
    }
  }
  return cyclic;
}

const byLineThenId = (a: LoadoutOptionGroup, b: LoadoutOptionGroup): number =>
  a.line - b.line || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** §6: option groups ordered by line then id; a child renders immediately after its parent's last
 *  line, indented two spaces per level of depth, capped at 2. A cyclic group is omitted outright
 *  and never participates as a parent or a child. */
function renderOptionGroupsTree(groups: readonly LoadoutOptionGroup[]): { lines: Line[]; omitted: string[] } {
  const lines: Line[] = [];
  const omitted: string[] = [];
  const cyclic = detectCycles(groups);
  for (const group of groups) {
    if (cyclic.has(group.id)) omitted.push('RND-OPT-GROUP-CYCLE');
  }

  const nonCyclic = groups.filter((g) => !cyclic.has(g.id));
  const idSet = new Set(nonCyclic.map((g) => g.id));
  const byParent = new Map<string, LoadoutOptionGroup[]>();
  const topLevel: LoadoutOptionGroup[] = [];
  for (const group of nonCyclic) {
    if (group.parentGroupId !== undefined && idSet.has(group.parentGroupId)) {
      const siblings = byParent.get(group.parentGroupId) ?? [];
      siblings.push(group);
      byParent.set(group.parentGroupId, siblings);
    } else {
      topLevel.push(group);
    }
  }

  function visit(group: LoadoutOptionGroup, depth: number): void {
    const result = renderOptionGroupOwnLines(group);
    omitted.push(...result.omitted);
    const indent = '  '.repeat(Math.min(depth, 2));
    for (const line of result.lines) {
      lines.push(indent ? [lit(indent), ...line] : line);
    }
    for (const child of [...(byParent.get(group.id) ?? [])].sort(byLineThenId)) {
      visit(child, depth + 1);
    }
  }

  for (const group of [...topLevel].sort(byLineThenId)) {
    visit(group, 0);
  }

  return { lines, omitted };
}

/** §4.6. */
function renderConstraint(row: LoadoutItemConstraint): RowResult {
  if (row.constraintType === 'not_replaceable' && row.modelName !== undefined) {
    return {
      line: [
        lit(strings.loadout.prefixThe),
        slotSeg('itemName', row.itemName, row.weaponLine),
        lit(strings.loadout.ofMiddle),
        slotSeg('modelName', row.modelName),
        lit(strings.loadout.cannotBeReplacedSuffix),
      ],
    };
  }
  if (row.constraintType === 'not_replaceable') {
    return { line: [slotSeg('itemName', row.itemName, row.weaponLine), lit(strings.loadout.cannotBeReplacedSuffix)] };
  }
  if (row.constraintType === 'one_per_unit') {
    return {
      line: [
        lit(strings.loadout.oneOnlyPrefix),
        slotSeg('itemName', row.itemName, row.weaponLine),
        lit(strings.prose.sentenceEnd),
      ],
    };
  }
  return { omitted: 'RND-CST-UNKNOWN-TYPE' };
}

export function renderOptionsBlock(input: LoadoutInput): BlockResult {
  const lines: Line[] = [];
  const omitted: string[] = [];

  const groupsResult = renderOptionGroupsTree(input.optionGroups ?? []);
  lines.push(...groupsResult.lines);
  omitted.push(...groupsResult.omitted);

  const constraints = [...(input.itemConstraints ?? [])].sort((a, b) => {
    if (a.itemName !== b.itemName) return a.itemName < b.itemName ? -1 : 1;
    if (a.constraintType !== b.constraintType) return a.constraintType < b.constraintType ? -1 : 1;
    return 0;
  });
  for (const constraint of constraints) {
    const result = renderConstraint(constraint);
    if (result.line) lines.push(result.line);
    else if (result.omitted) omitted.push(result.omitted);
  }

  const { canonical, segments, lines: assembledLines } = assemble(lines);
  return { canonical, segments, lines: assembledLines, omitted };
}
