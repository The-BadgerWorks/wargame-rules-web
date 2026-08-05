// AI-Assisted: Claude Code (model: claude-opus-5) - The post-build gate that runs as its own `node`
// step after `astro build`, so its exit code unambiguously belongs to us rather than to an Astro
// integration hook whose throw behaviour is not a documented failure contract (research D6).
//
// Because it is part of `npm run build` - the same command Cloudflare Workers Builds runs - a
// non-zero exit here means the deploy command never runs, no version is created, and the previous
// deployment keeps serving. This script IS the rollback mechanism.
//
// SCOPE AS OF PHASE 2 (Foundational). Only the site-wide guarantees BaseLayout makes are checkable
// yet, because no entity pages exist. Task T040 extends this same script with the remaining three
// release-gating checks:
//
//   - coverage      a dist/**/index.html for every faction, detachment and datasheet the route set
//                   expects, and no extra entity pages          (SC-001)
//   - internal links every href starting "/" resolves against that route set, offline  (SC-006)
//   - content boundary  every rendered text node is a bundle value or a chrome-strings entry
//                                                               (FR-024, SC-003)
//
// What is already enforced below is the banner-and-disclaimer half: FR-018/FR-019's banner and
// FR-023's disclaimer on 100% of rendered pages (SC-004).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DIST = path.resolve(process.cwd(), 'dist');

/** Markers the shared layout stamps on every page. Attribute-based, so wording changes cannot break the check. */
const REQUIRED_MARKERS = [
  { attribute: 'data-version-banner', requirement: 'FR-018 version banner' },
  { attribute: 'data-disclaimer', requirement: 'FR-023 unofficial / no-affiliation disclaimer' },
];

async function listHtmlFiles(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    throw new Error(`Cannot read ${dir}. Did astro build run?`, { cause });
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listHtmlFiles(full)));
    else if (entry.isFile() && entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

function relative(file) {
  return path.relative(DIST, file).split(path.sep).join('/');
}

const failures = [];

const pages = await listHtmlFiles(DIST);

if (pages.length === 0) {
  failures.push('dist/ contains no rendered HTML pages at all.');
}

for (const page of pages) {
  const html = await readFile(page, 'utf8');
  for (const marker of REQUIRED_MARKERS) {
    if (!html.includes(marker.attribute)) {
      failures.push(`${relative(page)} is missing the ${marker.requirement} (${marker.attribute}).`);
    }
  }
}

if (failures.length > 0) {
  console.error(`verify-dist: FAILED with ${failures.length} problem(s).`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('Nothing will be deployed; the previous deployment keeps serving.');
  process.exit(1);
}

console.log(
  `verify-dist: OK. ${pages.length} page(s) checked; every one carries the version banner and the disclaimer.`,
);
