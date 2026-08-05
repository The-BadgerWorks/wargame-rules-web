// AI-Assisted: Claude Code (model: claude-opus-5) - The four release-gating checks, run as their
// own `node` step after `astro build` so the exit code unambiguously belongs to us rather than to
// an Astro integration hook whose throw behaviour is not a documented failure contract
// (research D6, tasks T040 and T042).
//
// Because it is part of `npm run build` - the same command Cloudflare Workers Builds runs - a
// non-zero exit here means the deploy command never runs, no version is created, and the previous
// deployment keeps serving. This script IS the rollback mechanism.
//
//   coverage          a rendered page for every faction, detachment and datasheet the route set
//                     expects, and no entity page that no bundle row accounts for      (SC-001)
//   internal links    every href starting "/" resolves against that route set or an emitted
//                     asset, offline, with no network involved                         (SC-006)
//   content boundary  every rendered text node traces to a bundle value or to an entry of
//                     src/chrome-strings.json                              (FR-024, SC-003)
//   banner presence   dist/build-info.json agrees with the bundle the pages were rendered from,
//                     and 100% of pages carry the banner, the disclaimer, and - only when the
//                     selected version is withdrawn - the withdrawal notice            (SC-004)
//
// The expected route set comes from `src/data/bundle.ts`, the same module the pages were rendered
// from, rather than from the rendered output: an expectation derived from the thing it is checking
// is not an expectation. That import also means this script sees the identical manifest and bundle
// the build did, because both read WGC_WEB_MANIFEST_URL from the same environment.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { bundle, expectedRoutes, rulesVersion } from '../src/data/bundle.ts';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** `--dist <dir>`; defaults to what `astro build` writes. The tests point it at broken copies. */
function distFromArgv(argv) {
  const flag = argv.indexOf('--dist');
  if (flag === -1) return 'dist';
  const value = argv[flag + 1];
  if (!value || value.startsWith('--')) throw new Error('--dist needs a directory argument.');
  return value;
}

const DIST = path.resolve(process.cwd(), distFromArgv(process.argv.slice(2)));

const failures = [];
const fail = (message) => failures.push(message);

// ---------------------------------------------------------------------------
// Reading the build.
// ---------------------------------------------------------------------------

async function listFiles(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    throw new Error(`Cannot read ${dir}. Did astro build run?`, { cause });
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listFiles(full)));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

const relative = (file) => path.relative(DIST, file).split(path.sep).join('/');

const files = await listFiles(DIST);
const htmlFiles = files.filter((file) => file.endsWith('.html'));

const pages = new Map();
for (const file of htmlFiles) pages.set(relative(file), await readFile(file, 'utf8'));

if (pages.size === 0) fail(`${relative(DIST)} contains no rendered HTML pages at all.`);

// ---------------------------------------------------------------------------
// 1. Coverage (SC-001).
//
// Astro writes `<route>/index.html` for every route and `404.html` for the not-found page, so the
// mapping between the two sets is exact in both directions - which is what lets this check be an
// equality rather than a containment, and catch a page that should not exist as well as one that
// should.
// ---------------------------------------------------------------------------

const fileForRoute = (route) => (route === '/' ? 'index.html' : `${route.slice(1)}index.html`);

const expectedFiles = new Set(expectedRoutes.map(fileForRoute));
/** Not a route: Astro emits it for `not_found_handling: "404-page"`, so it has no entry set. */
expectedFiles.add('404.html');

for (const route of expectedRoutes) {
  if (!pages.has(fileForRoute(route))) {
    fail(`coverage: no page was rendered for ${route} (expected ${fileForRoute(route)}).`);
  }
}

for (const file of pages.keys()) {
  if (!expectedFiles.has(file)) {
    fail(`coverage: ${file} was rendered, but no bundle entity accounts for it.`);
  }
}

// ---------------------------------------------------------------------------
// 2. Internal links (SC-006).
//
// Resolved against the route set and the emitted files, never fetched: the site links only to
// itself, so a link check that needs a network is a link check that can fail for reasons that have
// nothing to do with the build.
// ---------------------------------------------------------------------------

const routeSet = new Set(expectedRoutes);
const emitted = new Set(files.map(relative));

function checkLinks(file, html) {
  for (const match of html.matchAll(/\shref="([^"]*)"/g)) {
    const raw = match[1];
    if (!raw.startsWith('/')) continue; // in-page anchors and absolute URLs are out of scope
    const target = raw.split('#')[0].split('?')[0];
    if (target === '') continue;
    if (routeSet.has(target)) continue;
    if (emitted.has(target.slice(1))) continue; // an emitted asset, e.g. /_astro/site.css
    fail(`links: ${file} links to ${raw}, which resolves to no page and no emitted file.`);
  }
}

// ---------------------------------------------------------------------------
// 3. Content boundary (FR-024, SC-003).
//
// Every rendered text node must trace to a value the bundle carries or to an entry of
// chrome-strings.json - the one authored-prose file. This is the mechanical half of Principle 4 on
// this side of the boundary: a sentence typed into a template, a lore blurb pasted into a
// component, or a paraphrase of publisher text cannot survive it.
//
// Composition is allowed and is why this is a tokeniser rather than a set lookup: a page title is
// "<entity name><separator><site name>", a weapon's ability keywords are one comma-separated bundle
// string rendered as discrete tokens, and a points delta is a bundle number with a sign. Each of
// those is a sequence of allowed values, and every piece must still be one.
// ---------------------------------------------------------------------------

const allowed = new Set();

function allow(value) {
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (trimmed === '') return;
  allowed.add(trimmed);
}

function allowString(value) {
  allow(value);
  // A comma-separated bundle field may be rendered as separate tokens (weapon ability keywords).
  if (value.includes(',')) for (const part of value.split(',')) allow(part);
  // An ISO timestamp may be rendered as its date half (the version banner).
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) allow(value.slice(0, 10));
}

function allowNumber(value) {
  allow(String(value));
  allow(`+${value}`); // a signed points delta
}

function collect(value) {
  if (typeof value === 'string') allowString(value);
  else if (typeof value === 'number') allowNumber(value);
  else if (Array.isArray(value)) for (const item of value) collect(item);
  else if (value !== null && typeof value === 'object') for (const item of Object.values(value)) collect(item);
}

collect(bundle);
collect(rulesVersion);
collect(JSON.parse(await readFile(path.join(REPO_ROOT, 'src', 'chrome-strings.json'), 'utf8')));

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
};

const decode = (value) =>
  value.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (entity) => ENTITIES[entity] ?? entity);

/** Text nodes only: script, style and comment content is markup, not rendered content. */
function textNodes(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/<[^>]*>/)
    .map((node) => decode(node).replace(/\s+/g, ' ').trim())
    .filter((node) => node !== '');
}

/**
 * True when the text can be consumed entirely by allowed values, longest match first, with
 * whitespace between them. Whitespace-only remainders are fine; anything else is untraceable.
 */
function traceable(text) {
  let at = 0;
  while (at < text.length) {
    if (text[at] === ' ') {
      at += 1;
      continue;
    }
    let consumed = 0;
    for (let end = text.length; end > at; end -= 1) {
      if (allowed.has(text.slice(at, end))) {
        consumed = end - at;
        break;
      }
    }
    if (consumed === 0) return false;
    at += consumed;
  }
  return true;
}

/** Checked once per distinct string: 2 000+ pages share a small vocabulary of chrome text. */
const decided = new Map();

function checkContent(file, html) {
  for (const node of textNodes(html)) {
    let ok = decided.get(node);
    if (ok === undefined) {
      ok = traceable(node);
      decided.set(node, ok);
    }
    if (!ok) {
      fail(
        `content: ${file} renders text that traces to neither the bundle nor ` +
          `src/chrome-strings.json: "${node.slice(0, 120)}".`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Banner presence and build-info agreement (SC-004, contract §4).
// ---------------------------------------------------------------------------

let buildInfo;
try {
  buildInfo = JSON.parse(await readFile(path.join(DIST, 'build-info.json'), 'utf8'));
} catch {
  fail('banner: build-info.json is missing or unreadable; scripts/build-info.mjs did not run.');
}

if (buildInfo) {
  const expectedInfo = {
    rulesVersionId: rulesVersion.rulesVersionId,
    bundleSha256: rulesVersion.bundleSha256,
    withdrawn: rulesVersion.withdrawn,
    channel: rulesVersion.channel,
  };
  for (const [field, expected] of Object.entries(expectedInfo)) {
    if (buildInfo[field] !== expected) {
      fail(
        `banner: build-info.json records ${field} "${String(buildInfo[field])}", but these pages ` +
          `were rendered from "${String(expected)}".`,
      );
    }
  }
  if (typeof buildInfo.builtFromCommit !== 'string' || buildInfo.builtFromCommit === '') {
    fail('banner: build-info.json has no builtFromCommit.');
  }
}

const withdrawn = buildInfo ? buildInfo.withdrawn === true : rulesVersion.withdrawn;

const REQUIRED_MARKERS = [
  { attribute: 'data-version-banner', requirement: 'FR-018 version banner' },
  { attribute: 'data-disclaimer', requirement: 'FR-023 unofficial / no-affiliation disclaimer' },
];

function checkMarkers(file, html) {
  for (const marker of REQUIRED_MARKERS) {
    if (!html.includes(marker.attribute)) {
      fail(`${file} is missing the ${marker.requirement} (${marker.attribute}).`);
    }
  }
  const hasNotice = html.includes('data-withdrawal-notice');
  if (withdrawn && !hasNotice) {
    fail(`${file} is missing the FR-019 withdrawal notice, but the rules version is withdrawn.`);
  }
  if (!withdrawn && hasNotice) {
    fail(`${file} shows a withdrawal notice, but the rules version is not withdrawn.`);
  }
}

// ---------------------------------------------------------------------------
// Run the per-page checks in one pass.
// ---------------------------------------------------------------------------

for (const [file, html] of pages) {
  checkMarkers(file, html);
  checkLinks(file, html);
  checkContent(file, html);
}

// A build that emitted nothing to check must never be reported as a pass.
if (files.length > 0 && pages.size === 0) fail('no HTML pages were produced.');
await stat(DIST); // surfaces a vanished output directory as an error rather than a silent pass

if (failures.length > 0) {
  console.error(`verify-dist: FAILED with ${failures.length} problem(s).`);
  for (const failure of failures.slice(0, 50)) console.error(`  - ${failure}`);
  if (failures.length > 50) console.error(`  ... and ${failures.length - 50} more.`);
  console.error('Nothing will be deployed; the previous deployment keeps serving.');
  process.exit(1);
}

console.log(
  `verify-dist: OK. ${pages.size} page(s) checked against ${expectedRoutes.length} expected ` +
    `route(s): coverage, internal links, content boundary, and banner presence all pass ` +
    `(rules version ${rulesVersion.rulesVersionId}, withdrawn ${withdrawn}).`,
);
