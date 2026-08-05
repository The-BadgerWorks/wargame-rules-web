// AI-Assisted: Claude Code (model: claude-opus-5) - The page-level test harness (tasks T020, T026).
//
// Research D6 pins component-level Container API use to the version-banner test and says
// "everything else asserts against built HTML, which has no such caveat". This module is how that
// is done: it runs the real `astro build` once per `vitest run`, against the SYNTHETIC fixtures in
// test/fixtures/, into `dist-test/`, and hands page tests the resulting HTML.
//
// Building for real - rather than rendering a page component in isolation - is deliberate. It is
// the only way a test can prove the things the user stories actually promise: that `getStaticPaths`
// emitted a page per entity, that the href a listing renders resolves to a page that exists, and
// that the shared layout wrapped it. A component-level render proves none of those.
//
// `setup` is wired as Vitest's `globalSetup` (vitest.config.ts), so the build happens exactly once
// before any test file runs, rather than once per worker.
import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Two builds, both kept out of `dist/` so a test build can never be mistaken for, or deployed as, a
 * real build:
 *
 *   current    the non-withdrawn fixture — what every page test asserts against
 *   withdrawn  the all-entries-withdrawn fixture — SC-004's other half
 *
 * The second build exists because SC-004 is a claim about 100% and 0% of pages in the two states,
 * and only a real build of each state can be counted. Both are cheap: the synthetic bundle renders
 * 17 pages.
 */
export const OUT_DIR = 'dist-test/current';
export const OUT_DIR_WITHDRAWN = 'dist-test/withdrawn';

const ASTRO_BIN = path.join(REPO_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
const BUILD_INFO_SCRIPT = path.join(REPO_ROOT, 'scripts', 'build-info.mjs');

const FIXTURE_MANIFEST = './test/fixtures/manifest-current.json';
const FIXTURE_MANIFEST_WITHDRAWN = './test/fixtures/manifest-all-withdrawn.json';

async function build(outDir: string, manifest: string): Promise<void> {
  const env = {
    ...process.env,
    WGC_WEB_CHANNEL: 'published',
    WGC_WEB_MANIFEST_URL: manifest,
  };
  const options = { cwd: REPO_ROOT, env, maxBuffer: 64 * 1024 * 1024 };

  await execFileAsync(process.execPath, [ASTRO_BIN, 'build', '--outDir', outDir], options);
  // The same step `npm run build` runs, so a test build carries the same dist/build-info.json the
  // deployed site does and the banner and verify-dist assertions have something real to read.
  await execFileAsync(process.execPath, [BUILD_INFO_SCRIPT, '--out-dir', outDir], options);
}

/** Vitest `globalSetup` entry point. Runs once, before the first test file. */
export async function setup(): Promise<void> {
  await build(OUT_DIR, FIXTURE_MANIFEST);
  await build(OUT_DIR_WITHDRAWN, FIXTURE_MANIFEST_WITHDRAWN);
}

function fileFor(route: string, outDir: string = OUT_DIR): string {
  if (route === '/404') return path.join(REPO_ROOT, outDir, '404.html');
  if (!route.startsWith('/') || !route.endsWith('/')) {
    throw new Error(`Route "${route}" is not a canonical trailing-slash route (research D1).`);
  }
  return path.join(REPO_ROOT, outDir, route.slice(1), 'index.html');
}

/** The built HTML for a route. Throws with the route in the message if the build never emitted it. */
export async function page(route: string, outDir: string = OUT_DIR): Promise<string> {
  const file = fileFor(route, outDir);
  try {
    return await readFile(file, 'utf8');
  } catch (cause) {
    throw new Error(`The build emitted no page for route "${route}" (expected ${file}).`, { cause });
  }
}

/** True when the build emitted a page for the route. Used to assert a page was NOT generated. */
export async function pageExists(route: string, outDir: string = OUT_DIR): Promise<boolean> {
  try {
    await readFile(fileFor(route, outDir), 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function htmlFilesIn(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFilesIn(full)));
    else if (entry.isFile() && entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

/**
 * Every rendered page of a build, keyed by its path relative to the output directory. This is what
 * turns a per-component assertion into SC-004's site-wide one: a claim about "100% of pages" has to
 * be measured over the actual set of pages, not over a sample a test remembered to list.
 */
export async function allPages(outDir: string = OUT_DIR): Promise<Map<string, string>> {
  const root = path.join(REPO_ROOT, outDir);
  const files = await htmlFilesIn(root);
  const pages = new Map<string, string>();
  for (const file of files) {
    pages.set(path.relative(root, file).split(path.sep).join('/'), await readFile(file, 'utf8'));
  }
  return pages;
}

/** A build's `build-info.json`, parsed. Throws if the build never wrote one. */
export async function buildInfo(outDir: string = OUT_DIR): Promise<Record<string, unknown>> {
  const file = path.join(REPO_ROOT, outDir, 'build-info.json');
  return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Assertion helpers.
//
// Pages carry `data-*` markers naming the entity each element represents, which is what lets these
// helpers stay regex-simple and lets a test say "this faction page lists exactly these three
// units" rather than "this string appears somewhere in the document".
// ---------------------------------------------------------------------------

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

/** Visible text, tags removed and whitespace collapsed. */
export function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every value of `data-<attr>` in document order, e.g. `attrValues(html, 'unit')`. */
export function attrValues(html: string, attr: string): string[] {
  const pattern = new RegExp(`\\sdata-${escapeRegExp(attr)}="([^"]*)"`, 'g');
  return [...html.matchAll(pattern)].map((m) => decodeEntities(m[1]!));
}

/** How many elements carry `data-<attr>`, valued or not. */
export function countAttr(html: string, attr: string): number {
  const pattern = new RegExp(`\\sdata-${escapeRegExp(attr)}(?=[\\s=>/])`, 'g');
  return [...html.matchAll(pattern)].length;
}

/** Every `href` in the document. */
export function hrefs(html: string): string[] {
  return [...html.matchAll(/\shref="([^"]*)"/g)].map((m) => decodeEntities(m[1]!));
}

/** The visible text of every anchor pointing at `href`. Empty when nothing links there. */
export function linkTexts(html: string, href: string): string[] {
  const pattern = new RegExp(`<a[^>]*\\shref="${escapeRegExp(href)}"[^>]*>([\\s\\S]*?)</a>`, 'g');
  return [...html.matchAll(pattern)].map((m) => text(m[1]!));
}

/**
 * Splits a document into the fragment belonging to each `data-<attr>="value"` element: every
 * fragment runs from its own marker to the start of the next one, so a "row" can be asserted on
 * without a DOM. The final fragment runs to the end of the document, so negative assertions
 * ("this row does not contain X") should be made against a row that is not the last.
 */
export function rows(html: string, attr: string): Map<string, string> {
  const parts = html.split(new RegExp(`\\sdata-${escapeRegExp(attr)}="`));
  const found = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const end = part.indexOf('"');
    found.set(decodeEntities(part.slice(0, end)), part.slice(end + 1));
  }
  return found;
}
