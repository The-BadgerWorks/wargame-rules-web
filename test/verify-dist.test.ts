// AI-Assisted: Claude Code (model: claude-opus-5) - Proof that the release gate actually gates
// (task T041; spec Edge Cases — rollback, Environment and Operational Impact — Rollback).
//
// The site has no deploy step of its own to test. Its rollback story is structural: verify-dist.mjs
// is part of `npm run build`, which is the exact command Cloudflare Workers Builds runs, so a
// non-zero exit means `wrangler deploy` never runs and the previous deployment keeps serving
// (research D3). That story rests entirely on the script exiting non-zero when something is wrong -
// which is a property of the script, and is what these cases measure.
//
// Each case copies the real fixture build, breaks exactly one thing, and requires a non-zero exit.
// A green control run guards against the opposite failure: a script that rejects everything gates
// nothing either, because the site would then never deploy at all.
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { OUT_DIR, REPO_ROOT } from './helpers/built-site.ts';

const SCRIPT = path.join(REPO_ROOT, 'scripts', 'verify-dist.mjs');
const SOURCE = path.join(REPO_ROOT, OUT_DIR);

/** A unit page the fixture bundle always produces; several cases break this one. */
const UNIT_PAGE = path.join('factions', 'verdant-concord', 'units', 'thicket-matriarch', 'index.html');

const temporaries: string[] = [];

afterAll(async () => {
  await Promise.all(temporaries.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A throwaway copy of the fixture build, so a case can break it without breaking the suite. */
async function copyOfBuild(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'wgc-verify-dist-'));
  temporaries.push(dir);
  await cp(SOURCE, dir, { recursive: true });
  return dir;
}

interface Run {
  code: number;
  output: string;
}

/** Runs the gate exactly as `npm run build` does, against a chosen directory. */
function runVerify(dist: string): Promise<Run> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, '--dist', dist],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          WGC_WEB_CHANNEL: 'published',
          WGC_WEB_MANIFEST_URL: './test/fixtures/manifest-current.json',
        },
        maxBuffer: 64 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
        resolve({ code, output: `${stdout}${stderr}` });
      },
    );
  });
}

async function editPage(dist: string, relative: string, edit: (html: string) => string): Promise<void> {
  const file = path.join(dist, relative);
  await writeFile(file, edit(await readFile(file, 'utf8')), 'utf8');
}

describe('verify-dist.mjs — the release gate', () => {
  it('passes an intact build, so the gate is not simply refusing everything', async () => {
    const run = await runVerify(await copyOfBuild());

    expect(run.output).toContain('verify-dist: OK');
    expect(run.code).toBe(0);
  });

  it('fails when a page the bundle expects was not rendered (SC-001 coverage)', async () => {
    const dist = await copyOfBuild();
    await rm(path.dirname(path.join(dist, UNIT_PAGE)), { recursive: true });

    const run = await runVerify(dist);

    expect(run.code).not.toBe(0);
    expect(run.output).toContain('thicket-matriarch');
  });

  it('fails when a page exists that no entity in the bundle accounts for', async () => {
    const dist = await copyOfBuild();
    const stray = path.join(dist, 'factions', 'ghost-faction');
    await cp(path.dirname(path.join(dist, UNIT_PAGE)), stray, { recursive: true });

    const run = await runVerify(dist);

    expect(run.code).not.toBe(0);
    expect(run.output).toContain('ghost-faction');
  });

  it('fails on an internal link that resolves to nothing (SC-006)', async () => {
    const dist = await copyOfBuild();
    await editPage(dist, 'index.html', (html) =>
      html.replace('</main>', '<a href="/factions/no-such-faction/">x</a></main>'),
    );

    const run = await runVerify(dist);

    expect(run.code).not.toBe(0);
    expect(run.output).toContain('/factions/no-such-faction/');
  });

  it('fails on rendered text that traces to neither the bundle nor chrome-strings (FR-024, SC-003)', async () => {
    const dist = await copyOfBuild();
    await editPage(dist, UNIT_PAGE, (html) =>
      html.replace(
        '</main>',
        '<p>Ten thousand years of unbroken vigil weighed upon the ancient warrior.</p></main>',
      ),
    );

    const run = await runVerify(dist);

    expect(run.code).not.toBe(0);
    expect(run.output).toContain('unbroken vigil');
  });

  it('fails when a page lost the version banner (SC-004)', async () => {
    const dist = await copyOfBuild();
    await editPage(dist, UNIT_PAGE, (html) => html.replace('data-version-banner', 'data-nothing'));

    const run = await runVerify(dist);

    expect(run.code).not.toBe(0);
    expect(run.output).toContain('banner');
  });

  it('fails when a page lost the disclaimer (FR-023)', async () => {
    const dist = await copyOfBuild();
    await editPage(dist, UNIT_PAGE, (html) => html.replace('data-disclaimer', 'data-nothing'));

    const run = await runVerify(dist);

    expect(run.code).not.toBe(0);
  });

  it('fails when build-info.json is missing, so the rebuild contract cannot silently lapse', async () => {
    const dist = await copyOfBuild();
    await rm(path.join(dist, 'build-info.json'));

    const run = await runVerify(dist);

    expect(run.code).not.toBe(0);
    expect(run.output).toContain('build-info.json');
  });

  it('fails when build-info.json names a version the pages were not built from', async () => {
    const dist = await copyOfBuild();
    const file = path.join(dist, 'build-info.json');
    const info = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    await writeFile(file, JSON.stringify({ ...info, rulesVersionId: 'synth-1999-01' }), 'utf8');

    const run = await runVerify(dist);

    expect(run.code).not.toBe(0);
    expect(run.output).toContain('synth-1999-01');
  });

  it('fails on an empty output directory rather than reporting a vacuous pass', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'wgc-verify-dist-empty-'));
    temporaries.push(dir);

    const run = await runVerify(dir);

    expect(run.code).not.toBe(0);
  });
});
