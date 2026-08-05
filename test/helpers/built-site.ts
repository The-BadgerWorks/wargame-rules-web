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
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Kept out of `dist/` so a test build can never be mistaken for, or deployed as, a real build. */
export const OUT_DIR = 'dist-test';

const ASTRO_BIN = path.join(REPO_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
const FIXTURE_MANIFEST = './test/fixtures/manifest-current.json';

/** Vitest `globalSetup` entry point. Runs once, before the first test file. */
export async function setup(): Promise<void> {
  await execFileAsync(process.execPath, [ASTRO_BIN, 'build', '--outDir', OUT_DIR], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      WGC_WEB_CHANNEL: 'published',
      WGC_WEB_MANIFEST_URL: FIXTURE_MANIFEST,
    },
    maxBuffer: 64 * 1024 * 1024,
  });
}

function fileFor(route: string): string {
  if (route === '/404') return path.join(REPO_ROOT, OUT_DIR, '404.html');
  if (!route.startsWith('/') || !route.endsWith('/')) {
    throw new Error(`Route "${route}" is not a canonical trailing-slash route (research D1).`);
  }
  return path.join(REPO_ROOT, OUT_DIR, route.slice(1), 'index.html');
}

/** The built HTML for a route. Throws with the route in the message if the build never emitted it. */
export async function page(route: string): Promise<string> {
  const file = fileFor(route);
  try {
    return await readFile(file, 'utf8');
  } catch (cause) {
    throw new Error(`The build emitted no page for route "${route}" (expected ${file}).`, { cause });
  }
}

/** True when the build emitted a page for the route. Used to assert a page was NOT generated. */
export async function pageExists(route: string): Promise<boolean> {
  try {
    await readFile(fileFor(route), 'utf8');
    return true;
  } catch {
    return false;
  }
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
