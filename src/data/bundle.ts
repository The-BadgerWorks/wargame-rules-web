// AI-Assisted: Claude Code (model: claude-opus-5) - The build's single data input (task T013,
// research D4): fetch the published manifest, select the current rules version per FR-020, download
// the bundle that entry names, refuse it unless BOTH its byte size and its sha256 match the
// manifest, parse once, and export frozen lookup maps.
//
// AI-Assisted note (model: claude-sonnet-5, PO review finding 2026-08-05): added childFactionsOf
// and topLevelFactions below, for the faction index/faction-page sub-faction nesting change.
//
// Two rules that are easy to get wrong and are therefore written down (research D4):
//
//   1. NEVER fetch in a component. Component frontmatter re-runs per page, so a fetch there would
//      fire once per rendered unit page. This module is evaluated exactly once per build because
//      ESM module instances are singletons in the Vite graph, and `getStaticPaths` is explicitly
//      allowed to reference file imports.
//   2. Build every index at module scope, never per page.
//
// The checksum assertion is why a credential-free build can trust a third-party download. There is
// deliberately NO "continue anyway" path: a mismatch throws, the top-level await propagates it,
// `astro build` exits non-zero, the deploy command never runs, and the previous deployment keeps
// serving. That is the whole rollback mechanism (plan.md, Risks and Rollback).
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CHANNEL, MANIFEST_URL, USE_BUNDLE_CACHE } from '../config.ts';
import {
  assertSupportedManifest,
  selectCurrentVersion,
  type ManifestEntry,
} from './select-version.ts';
import { assertUniqueSlugs, detachSlug, factionCode, unitSlug } from './slugs.ts';

// ---------------------------------------------------------------------------
// Bundle shape. Governed by wargame-rules-data/schemas/bundle.schema.json and by
// 001-army-builder-app/contracts/reference-db-schema.md v1.2.0. This file mirrors those
// definitions for type-checking; it does not redefine them. Absent optionals are OMITTED from the
// published document, never null, which is why every optional below is `?` and never `| null`.
// ---------------------------------------------------------------------------

export interface Edition {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
}

export interface Faction {
  id: string;
  editionId: string;
  code: string;
  name: string;
  parentFactionId?: string;
}

export interface Detachment {
  id: string;
  editionId: string;
  factionId: string;
  name: string;
  detachmentPointsCost: number;
  isLegends: boolean;
}

export type RestrictionType =
  | 'max_copies_per_datasheet'
  | 'max_units_with_keyword'
  | 'min_units_with_keyword'
  | 'requires_keyword_in_army'
  | 'forbids_keyword_in_army'
  | 'forbids_datasheet'
  | 'legends_allowed'
  | 'max_enhancements'
  | 'unique_epic_heroes';

export interface DetachmentRestriction {
  id: string;
  editionId: string;
  /** Omitted means the restriction applies edition-wide rather than to one detachment. */
  detachmentId?: string;
  restrictionType: RestrictionType;
  paramsJson: string;
  /** The authored, player-facing message. FR-005 renders THIS, never restrictionType. */
  messageTemplate: string;
}

export interface Enhancement {
  id: string;
  editionId: string;
  detachmentId: string;
  name: string;
  points: number;
  maxPerArmy: number;
}

export interface EnhancementEligibility {
  enhancementId: string;
  ruleType: 'requires_keyword' | 'forbids_keyword' | 'datasheet_allowlist';
  value: string;
}

export interface Datasheet {
  id: string;
  editionId: string;
  factionId: string;
  name: string;
  role?: string;
  isLegends: boolean;
  isCharacter: boolean;
  isEpicHero: boolean;
  isBattleline: boolean;
  isDedicatedTransport: boolean;
  maxCopiesPerArmy?: number;
  damagedThreshold?: number;
  detailEditionCode?: string;
}

export interface DatasheetKeyword {
  datasheetId: string;
  keyword: string;
  isFactionKeyword: boolean;
  modelScope?: string;
}

export interface DatasheetModel {
  datasheetId: string;
  line: number;
  name: string;
  movement: string;
  toughness: number;
  save: string;
  invulnSave?: string;
  wounds: number;
  leadership: string;
  objectiveControl: number;
  baseSize?: string;
}

export interface DatasheetWeapon {
  datasheetId: string;
  line: number;
  name: string;
  isMelee: boolean;
  range?: string;
  attacks: string;
  skill: string;
  strength: string;
  armourPenetration: string;
  damage: string;
  /** Comma-separated ability KEYWORDS only. Never rules text. */
  abilityKeywords?: string;
}

export interface DatasheetAbility {
  datasheetId: string;
  name: string;
  abilityType: 'core' | 'faction' | 'datasheet';
  /** An original, mechanics-only summary authored upstream. Never the publisher's rules text. */
  summary: string;
}

export type PricingConfidence = 'verified' | 'unverified';

export interface DatasheetCost {
  datasheetId: string;
  modelCount: number;
  points: number;
  label: string;
  pricingConfidence: PricingConfidence;
}

export interface DatasheetCostTier extends DatasheetCost {
  copyIndexMin: number;
}

export interface DatasheetWargearOption {
  id: string;
  datasheetId: string;
  groupKey: string;
  name: string;
  pointsDelta: number;
  maxPerUnit?: number;
  modelsPerInstance?: number;
}

export interface DatasheetLeaderPair {
  leaderDatasheetId: string;
  bodyguardDatasheetId: string;
}

export interface SnapshotMeta {
  schemaContractVersion: number;
  restrictionVocabularyVersion: number;
  rulesVersionId: string;
  publishedAt: string;
  sourceNote: string;
}

export interface Bundle {
  bundleFormatVersion: number;
  snapshotMeta: SnapshotMeta;
  editions: Edition[];
  editionRules: { editionId: string; ruleKey: string; valueJson: string }[];
  gameSizeRules: unknown[];
  factions: Faction[];
  detachments: Detachment[];
  detachmentRestrictions: DetachmentRestriction[];
  enhancements: Enhancement[];
  enhancementEligibility: EnhancementEligibility[];
  datasheets: Datasheet[];
  datasheetKeywords: DatasheetKeyword[];
  datasheetModels: DatasheetModel[];
  datasheetWeapons: DatasheetWeapon[];
  datasheetAbilities: DatasheetAbility[];
  datasheetCosts: DatasheetCost[];
  datasheetCostTiers: DatasheetCostTier[];
  datasheetWargearOptions: DatasheetWargearOption[];
  datasheetLeaderPairs: DatasheetLeaderPair[];
  /** Always present and always empty by contract. The site never reads it. */
  datasheetDetachmentEligibility: never[];
}

/** What every page's banner reads, and what dist/build-info.json records. */
export interface RulesVersion {
  rulesVersionId: string;
  displayName: string;
  publishedAt: string;
  withdrawn: boolean;
  withdrawnReason: string | null;
  bundleSha256: string;
  sizeBytes: number;
  editionCodes: readonly string[];
  /** The bundle's own authored, factual provenance note. Carries no endorsement claim. */
  sourceNote: string;
  channel: string;
}

/** This build's supported bundle MAJOR, and the consumer-contract floor it requires. */
const SUPPORTED_BUNDLE_FORMAT_VERSION = 1;
const MINIMUM_SCHEMA_CONTRACT_VERSION = 1;

// ---------------------------------------------------------------------------
// Fetching. `https:` and `file:` are both first-class so the entire pipeline - selection, checksum
// verification, indexing - is exercised identically against the synthetic fixtures and against the
// live published manifest. There is no fixture-only branch that could hide a defect.
// ---------------------------------------------------------------------------

const SUPPORTED_PROTOCOLS = new Set(['https:', 'http:', 'file:']);

function resolveLocation(spec: string, base?: URL): URL {
  if (base) return new URL(spec, base);
  try {
    const url = new URL(spec);
    // A Windows absolute path such as C:\tmp\manifest.json parses as a URL whose protocol is "c:",
    // so the protocol allowlist - not merely "did it parse" - is what distinguishes a URL from a
    // local path here.
    if (SUPPORTED_PROTOCOLS.has(url.protocol)) return url;
  } catch {
    // Not a URL at all; fall through to the filesystem interpretation.
  }
  return pathToFileURL(path.resolve(process.cwd(), spec));
}

async function readLocation(url: URL): Promise<Uint8Array> {
  if (url.protocol === 'file:') {
    return new Uint8Array(await readFile(fileURLToPath(url)));
  }

  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
    throw new Error(`Refusing to read ${url.href}: unsupported protocol "${url.protocol}".`);
  }

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`GET ${url.href} returned HTTP ${response.status} ${response.statusText}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function decodeJson<T>(bytes: Uint8Array, sourceUrl: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch (cause) {
    throw new Error(`Document at ${sourceUrl} is not valid JSON.`, { cause });
  }
}

const CACHE_DIR = path.resolve(process.cwd(), 'node_modules', '.cache', 'wargame-rules-web');

function cachePathFor(sha256: string): string {
  return path.join(CACHE_DIR, `bundle-${sha256}.json`);
}

/** Dev-only. A cached file is still checksum-verified below, so the cache cannot weaken FR-001. */
async function readCachedBundle(entry: ManifestEntry): Promise<Uint8Array | undefined> {
  if (!USE_BUNDLE_CACHE) return undefined;
  try {
    return new Uint8Array(await readFile(cachePathFor(entry.sha256)));
  } catch {
    return undefined;
  }
}

async function writeCachedBundle(entry: ManifestEntry, bytes: Uint8Array): Promise<void> {
  if (!USE_BUNDLE_CACHE) return;
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePathFor(entry.sha256), bytes);
  } catch {
    // A cache that cannot be written is a missing nicety, not a build failure.
  }
}

/**
 * The integrity gate. FR-001's credential-free build rests entirely on this: the manifest is the
 * authority for what the bundle must be, and a download that is not byte-for-byte that document is
 * refused before a single field is read.
 */
function assertIntegrity(entry: ManifestEntry, bytes: Uint8Array, sourceUrl: string): void {
  if (bytes.byteLength !== entry.sizeBytes) {
    throw new Error(
      `Bundle at ${sourceUrl} is ${bytes.byteLength} bytes, but manifest entry ` +
        `"${entry.rulesVersionId}" declares ${entry.sizeBytes}. Refusing to build.`,
    );
  }

  const actual = sha256Hex(bytes);
  const expected = entry.sha256.toLowerCase();
  if (actual !== expected) {
    throw new Error(
      `Bundle at ${sourceUrl} has sha256 ${actual}, but manifest entry ` +
        `"${entry.rulesVersionId}" declares ${expected}. Refusing to build.`,
    );
  }
}

function assertBundleContract(bundle: Bundle, sourceUrl: string): void {
  if (bundle.bundleFormatVersion !== SUPPORTED_BUNDLE_FORMAT_VERSION) {
    throw new Error(
      `Bundle at ${sourceUrl} declares bundleFormatVersion ${bundle.bundleFormatVersion}; ` +
        `this build understands ${SUPPORTED_BUNDLE_FORMAT_VERSION}.`,
    );
  }

  const contract = bundle.snapshotMeta?.schemaContractVersion;
  if (typeof contract !== 'number' || contract < MINIMUM_SCHEMA_CONTRACT_VERSION) {
    throw new Error(
      `Bundle at ${sourceUrl} declares schemaContractVersion ${String(contract)}; ` +
        `this build requires at least ${MINIMUM_SCHEMA_CONTRACT_VERSION}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Load. One top-level await, evaluated once per build.
// ---------------------------------------------------------------------------

const manifestUrl = resolveLocation(MANIFEST_URL);
const manifest = assertSupportedManifest(
  decodeJson<unknown>(await readLocation(manifestUrl), manifestUrl.href),
  manifestUrl.href,
);

const currentEntry = selectCurrentVersion(manifest.versions);
const bundleUrl = resolveLocation(currentEntry.fileUrl, manifestUrl);

let bundleBytes = await readCachedBundle(currentEntry);
if (bundleBytes === undefined) {
  bundleBytes = await readLocation(bundleUrl);
  assertIntegrity(currentEntry, bundleBytes, bundleUrl.href);
  await writeCachedBundle(currentEntry, bundleBytes);
} else {
  // A cached copy is verified on every read, so a corrupted or hand-edited cache cannot be trusted
  // into a build.
  assertIntegrity(currentEntry, bundleBytes, cachePathFor(currentEntry.sha256));
}

const parsed = decodeJson<Bundle>(bundleBytes, bundleUrl.href);
assertBundleContract(parsed, bundleUrl.href);

// ---------------------------------------------------------------------------
// Indexes. Built once, at module scope.
// ---------------------------------------------------------------------------

function groupBy<T>(rows: readonly T[], key: (row: T) => string): ReadonlyMap<string, readonly T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const existing = map.get(k);
    if (existing) existing.push(row);
    else map.set(k, [row]);
  }
  for (const list of map.values()) Object.freeze(list);
  return map;
}

function indexBy<T>(rows: readonly T[], key: (row: T) => string): ReadonlyMap<string, T> {
  return new Map(rows.map((row) => [key(row), row]));
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

export const bundle: Readonly<Bundle> = Object.freeze(parsed);

export const rulesVersion: Readonly<RulesVersion> = Object.freeze({
  rulesVersionId: currentEntry.rulesVersionId,
  displayName: currentEntry.displayName,
  publishedAt: currentEntry.publishedAt,
  withdrawn: currentEntry.withdrawn === true,
  withdrawnReason: currentEntry.withdrawnReason ?? null,
  bundleSha256: currentEntry.sha256.toLowerCase(),
  sizeBytes: currentEntry.sizeBytes,
  editionCodes: Object.freeze([...currentEntry.editionCodes]),
  sourceNote: parsed.snapshotMeta.sourceNote,
  channel: CHANNEL,
});

export const factions: readonly Faction[] = Object.freeze([...parsed.factions].sort(byName));
export const factionsById: ReadonlyMap<string, Faction> = indexBy(factions, (f) => f.id);
export const factionsByCode: ReadonlyMap<string, Faction> = indexBy(factions, (f) =>
  factionCode(f.code),
);

/** A sub-faction shows its parent as a link; the parent does NOT absorb the child's units (D1). */
export function parentFactionOf(faction: Faction): Faction | undefined {
  return faction.parentFactionId ? factionsById.get(faction.parentFactionId) : undefined;
}

/**
 * The factions whose `parentFactionId` is `faction.id`, in the same name order as `factions`.
 * PO review finding (2026-08-05): a sub-faction still owns its own detachments and units (D1's
 * divergence from `reference-db-schema.md` §3.5 is unchanged), but it is no longer listed as its
 * own top-level entry on the faction index — it nests under this list on its parent's card and on
 * the parent's own page instead. See src/data/sub-factions.ts for the group-heading label.
 */
export function childFactionsOf(faction: Faction): readonly Faction[] {
  return factions.filter((f) => f.parentFactionId === faction.id);
}

/** Every faction with no parent. What the faction index renders one card per (PO review 2026-08-05,
 *  above); a sub-faction reaches the index only nested under this list's matching entry. */
export const topLevelFactions: readonly Faction[] = Object.freeze(
  factions.filter((f) => !f.parentFactionId),
);

export const detachments: readonly Detachment[] = Object.freeze([...parsed.detachments].sort(byName));
export const detachmentsById: ReadonlyMap<string, Detachment> = indexBy(detachments, (d) => d.id);
export const detachmentsByFaction: ReadonlyMap<string, readonly Detachment[]> = groupBy(
  detachments,
  (d) => d.factionId,
);

export const datasheets: readonly Datasheet[] = Object.freeze([...parsed.datasheets].sort(byName));
export const datasheetsById: ReadonlyMap<string, Datasheet> = indexBy(datasheets, (d) => d.id);
export const unitsByFaction: ReadonlyMap<string, readonly Datasheet[]> = groupBy(
  datasheets,
  (d) => d.factionId,
);

export const enhancementsByDetachment: ReadonlyMap<string, readonly Enhancement[]> = groupBy(
  [...parsed.enhancements].sort(byName),
  (e) => e.detachmentId,
);
export const enhancementEligibilityByEnhancement: ReadonlyMap<
  string,
  readonly EnhancementEligibility[]
> = groupBy(parsed.enhancementEligibility, (e) => e.enhancementId);

/**
 * A restriction with no detachmentId applies edition-wide. Both collections are empty in the live
 * bundle today (research §0), so the "no restrictions recorded" branch is the common case at
 * launch rather than a fallback.
 */
export const restrictionsByDetachment: ReadonlyMap<string, readonly DetachmentRestriction[]> =
  groupBy(
    parsed.detachmentRestrictions.filter((r) => r.detachmentId !== undefined),
    (r) => r.detachmentId!,
  );
export const editionWideRestrictions: readonly DetachmentRestriction[] = Object.freeze(
  parsed.detachmentRestrictions.filter((r) => r.detachmentId === undefined),
);

const byLine = (a: { line: number }, b: { line: number }) => a.line - b.line;

export const modelsByDatasheet: ReadonlyMap<string, readonly DatasheetModel[]> = groupBy(
  [...parsed.datasheetModels].sort(byLine),
  (m) => m.datasheetId,
);
export const weaponsByDatasheet: ReadonlyMap<string, readonly DatasheetWeapon[]> = groupBy(
  [...parsed.datasheetWeapons].sort(byLine),
  (w) => w.datasheetId,
);
export const abilitiesByDatasheet: ReadonlyMap<string, readonly DatasheetAbility[]> = groupBy(
  parsed.datasheetAbilities,
  (a) => a.datasheetId,
);
export const keywordsByDatasheet: ReadonlyMap<string, readonly DatasheetKeyword[]> = groupBy(
  parsed.datasheetKeywords,
  (k) => k.datasheetId,
);
export const costsByDatasheet: ReadonlyMap<string, readonly DatasheetCost[]> = groupBy(
  [...parsed.datasheetCosts].sort((a, b) => a.modelCount - b.modelCount),
  (c) => c.datasheetId,
);
export const costTiersByDatasheet: ReadonlyMap<string, readonly DatasheetCostTier[]> = groupBy(
  [...parsed.datasheetCostTiers].sort(
    (a, b) => a.modelCount - b.modelCount || a.copyIndexMin - b.copyIndexMin,
  ),
  (c) => c.datasheetId,
);
export const wargearOptionsByDatasheet: ReadonlyMap<string, readonly DatasheetWargearOption[]> =
  groupBy(parsed.datasheetWargearOptions, (o) => o.datasheetId);
export const leaderPairsByLeader: ReadonlyMap<string, readonly DatasheetLeaderPair[]> = groupBy(
  parsed.datasheetLeaderPairs,
  (p) => p.leaderDatasheetId,
);

// ---------------------------------------------------------------------------
// Routing. Slugs are derived and asserted here, once, so a charset violation or a collision fails
// the build before a single page is rendered (D1).
// ---------------------------------------------------------------------------

assertUniqueSlugs(
  'faction',
  factions.map((f) => factionCode(f.code)),
);
assertUniqueSlugs(
  'detachment',
  detachments.map((d) => detachSlug(d.id)),
);
assertUniqueSlugs(
  'unit',
  datasheets.map((d) => unitSlug(d.id)),
);

export const detachmentSlugById: ReadonlyMap<string, string> = new Map(
  detachments.map((d) => [d.id, detachSlug(d.id)]),
);
export const unitSlugById: ReadonlyMap<string, string> = new Map(
  datasheets.map((d) => [d.id, unitSlug(d.id)]),
);

function factionCodeOf(factionId: string): string {
  const faction = factionsById.get(factionId);
  if (!faction) {
    throw new Error(`Entity references faction "${factionId}", which the bundle does not define.`);
  }
  return factionCode(faction.code);
}

export function factionHref(faction: Faction): string {
  return `/factions/${factionCode(faction.code)}/`;
}

export function detachmentHref(detachment: Detachment): string {
  return `/factions/${factionCodeOf(detachment.factionId)}/detachments/${detachmentSlugById.get(detachment.id)!}/`;
}

export function unitHref(datasheet: Datasheet): string {
  return `/factions/${factionCodeOf(datasheet.factionId)}/units/${unitSlugById.get(datasheet.id)!}/`;
}

/**
 * The route set SC-001's coverage check and SC-006's link check are measured against. Derived from
 * the bundle rather than from rendered output, so it is an independent expectation and not a
 * restatement of what the build happened to emit.
 */
export const expectedRoutes: readonly string[] = Object.freeze([
  '/',
  ...factions.map(factionHref),
  ...detachments.map(detachmentHref),
  ...datasheets.map(unitHref),
]);
