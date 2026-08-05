// AI-Assisted: Claude Code (model: claude-opus-5) - Writes dist/build-info.json (task T037), the
// one artifact contracts/rebuild-notification.md §4 makes the site responsible for.
//
// It is what makes the rebuild contract observable from outside. `manifest-watch.yml` fetches this
// file from the LIVE site and compares it against the published manifest: that comparison is the
// contract's only detector for a rebuild notification that was never sent, was sent to a rotated
// URL, or started a build that then failed. Without this file, a stale deployment is invisible.
//
// It runs as its own `node` step between `astro build` and `scripts/verify-dist.mjs`, and it
// imports `src/data/bundle.ts` directly rather than re-deriving anything: the rules version this
// records must be the one the pages were rendered from, and re-implementing FR-020's selection rule
// in a second place is how the two come to disagree. (Node strips the TypeScript types on import;
// `engines.node` states the floor for that.)
//
// The written document is exactly the five fields §4 specifies - no more, because the file is
// public, and no fewer, because the watch reads three of them.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { rulesVersion } from '../src/data/bundle.ts';

/** `--out-dir <dir>`; defaults to the directory `astro build` writes. Tests build elsewhere. */
function outDirFromArgv(argv) {
  const flag = argv.indexOf('--out-dir');
  if (flag === -1) return 'dist';
  const value = argv[flag + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('--out-dir needs a directory argument.');
  }
  return value;
}

/**
 * The commit the deployed bytes were built from. Workers Builds and GitHub Actions each name it
 * differently, and a local build has neither, so git is the last resort and "unknown" the last of
 * all - an unattributable build is worth recording as such rather than failing over.
 */
function builtFromCommit() {
  const fromEnv =
    process.env.WORKERS_CI_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.CF_PAGES_COMMIT_SHA ??
    '';
  if (fromEnv !== '') return fromEnv;

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const outDir = path.resolve(process.cwd(), outDirFromArgv(process.argv.slice(2)));
const target = path.join(outDir, 'build-info.json');

// contracts/rebuild-notification.md §4. Key order matches the contract's example so a human diffing
// a deployed file against the contract sees no spurious movement.
const buildInfo = {
  rulesVersionId: rulesVersion.rulesVersionId,
  bundleSha256: rulesVersion.bundleSha256,
  withdrawn: rulesVersion.withdrawn,
  builtFromCommit: builtFromCommit(),
  channel: rulesVersion.channel,
};

await mkdir(outDir, { recursive: true });
await writeFile(target, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');

console.log(
  `build-info: wrote ${path.relative(process.cwd(), target)} for ${buildInfo.rulesVersionId} ` +
    `(channel ${buildInfo.channel}, withdrawn ${buildInfo.withdrawn}).`,
);
