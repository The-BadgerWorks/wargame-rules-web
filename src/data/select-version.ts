// AI-Assisted: Claude Code (model: claude-opus-5) - FR-020's rules-version selection rule, kept in
// its own module so it is unit-testable in isolation from the fetch and checksum machinery of
// bundle.ts (task T012, plan.md Project Structure). The manifest shape is governed by
// 001-army-builder-app/contracts/rules-data-manifest.md v1.1.1; this file must not redefine it.

/** This build's manifest MAJOR. A manifest above it is refused rather than guessed at. */
export const SUPPORTED_MANIFEST_VERSION = 1;

/** One entry of the published manifest. Field meanings are the manifest contract's, not ours. */
export interface ManifestEntry {
  rulesVersionId: string;
  displayName: string;
  publishedAt: string;
  editionCodes: string[];
  schemaContractVersion: number;
  restrictionVocabularyVersion: number;
  fileUrl: string;
  sizeBytes: number;
  sha256: string;
  withdrawn: boolean;
  withdrawnReason?: string | null;
}

export interface Manifest {
  manifestVersion: number;
  generatedAt: string;
  versions: ManifestEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Narrow an arbitrary parsed document to a Manifest, or throw.
 *
 * The refusal above SUPPORTED_MANIFEST_VERSION is deliberate: a newer manifest MAJOR may have
 * changed the meaning of a field this build reads, and rendering a site from a document we only
 * half understand is worse than not building at all.
 */
export function assertSupportedManifest(document: unknown, sourceUrl: string): Manifest {
  if (!isRecord(document)) {
    throw new Error(`Manifest at ${sourceUrl} is not a JSON object.`);
  }

  const { manifestVersion, versions } = document;

  if (typeof manifestVersion !== 'number' || !Number.isInteger(manifestVersion)) {
    throw new Error(`Manifest at ${sourceUrl} has no integer manifestVersion.`);
  }

  if (manifestVersion > SUPPORTED_MANIFEST_VERSION) {
    throw new Error(
      `Manifest at ${sourceUrl} declares manifestVersion ${manifestVersion}, but this build ` +
        `understands at most ${SUPPORTED_MANIFEST_VERSION}. Refusing to build from it.`,
    );
  }

  if (!Array.isArray(versions)) {
    throw new Error(`Manifest at ${sourceUrl} has no versions array.`);
  }

  return document as unknown as Manifest;
}

/** Newest first by publishedAt; rulesVersionId breaks a tie so the order is total and stable. */
function newestFirst(a: ManifestEntry, b: ManifestEntry): number {
  const byDate = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  if (byDate !== 0 && Number.isFinite(byDate)) return byDate;
  return b.rulesVersionId.localeCompare(a.rulesVersionId);
}

/**
 * FR-020. The single current rules version:
 *
 *   1. the newest entry that is not withdrawn;
 *   2. failing that — every listed entry is withdrawn — the newest entry outright, with its
 *      withdrawal state carried forward so FR-019's notice renders on every page.
 *
 * "Newest" is by publishedAt, never by position in the array: the manifest contract states that
 * ordering is not significant.
 */
export function selectCurrentVersion(versions: readonly ManifestEntry[]): ManifestEntry {
  if (versions.length === 0) {
    throw new Error('The manifest lists no rules versions, so there is nothing to build from.');
  }

  const ordered = [...versions].sort(newestFirst);
  const newestLive = ordered.find((entry) => !entry.withdrawn);

  return newestLive ?? ordered[0]!;
}
