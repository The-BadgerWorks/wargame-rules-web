// AI-Assisted: Claude Code (model: claude-opus-5) - The fallback rebuild watch
// (task T046; contracts/rebuild-notification.md §4, FR-025, spec Monitoring).
//
// The deploy hook is fire-and-forget by design: contract §1.2 requires a failed, refused, timed-out
// or unconfigured notification to be inert on the publishing side, so `wargame-rules-data` cannot
// tell whether a rebuild happened. This script is the contract's ONLY detector for the three
// resulting failure modes - a notification that was never sent, one sent to a rotated or deleted
// URL, and one that started a build which then failed - and therefore how the spec's "a failed or
// skipped rebuild MUST be visible to the site's maintainers" clause is met.
//
// It compares two published facts and nothing else: the manifest's currently selected version
// (FR-020's rule, imported rather than restated) against the LIVE site's /build-info.json. On
// divergence it POSTs the deploy hook and then FAILS the run, loudly, naming both versions - the
// POST alone would leave the failure that caused the drift unexamined.
//
// The hook URL is a secret whose whole content is the credential (contract §2), so it is read from
// the environment, never logged, never interpolated into a message, and never included in an error
// - which is why the catch below reports a fixed string rather than the thrown error.
import process from 'node:process';

import { MANIFEST_URL } from '../src/config.ts';
import { assertSupportedManifest, selectCurrentVersion } from '../src/data/select-version.ts';

const TIMEOUT_MS = 10_000;

/** GitHub Actions annotations, so a divergence lands on the run summary, not only in the log. */
function annotate(level, message) {
  console.log(`::${level}::${message}`);
}

/**
 * `AbortSignal.timeout` leaves a live handle behind when the process exits early, so the timer is
 * owned here and always cleared. Nothing about the watch should depend on how a runtime tears down.
 */
async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: 'follow', ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, what) {
  const response = await fetchWithTimeout(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`GET ${what} returned HTTP ${response.status} ${response.statusText}.`);
  }
  return await response.json();
}

/**
 * Firing the hook is a recovery attempt, not the point of the run: whether it succeeds or not, the
 * run still fails so a human looks at why the drift happened. The URL never reaches the log.
 */
async function fireDeployHook() {
  const url = process.env.CF_DEPLOY_HOOK_URL ?? '';
  if (url === '') {
    annotate('warning', 'CF_DEPLOY_HOOK_URL is not configured; no rebuild was requested.');
    return;
  }
  try {
    const response = await fetchWithTimeout(url, { method: 'POST' });
    console.log(`Requested a rebuild via the deploy hook (HTTP ${response.status}).`);
  } catch {
    // Deliberately not `error.message`: a fetch failure can quote the URL, which is the secret.
    annotate('warning', 'The deploy hook POST failed. Trigger a rebuild manually.');
  }
}

async function main() {
  const siteUrl = (process.env.WGC_WEB_SITE_URL ?? '').trim();

  if (siteUrl === '') {
    // The site's public hostname is a repository variable, not a code constant (research "Open
    // items" #3), and it is genuinely not decided yet. A watch that guessed a hostname would report
    // a permanent, meaningless divergence, so the honest behaviour is to no-op and say so.
    annotate(
      'warning',
      'WGC_WEB_SITE_URL is not set, so there is no live site to compare against. ' +
        'Set the repository variable to the deployed base URL to enable the watch.',
    );
    return 0;
  }

  const buildInfoUrl = new URL('/build-info.json', siteUrl).href;

  const manifest = assertSupportedManifest(
    await getJson(MANIFEST_URL, 'the manifest'),
    MANIFEST_URL,
  );
  const expected = selectCurrentVersion(manifest.versions);

  let deployed;
  try {
    deployed = await getJson(buildInfoUrl, buildInfoUrl);
  } catch (error) {
    // No readable build-info.json means the site is unreachable, or was deployed by something that
    // is not this build. Either way it is not serving the manifest's current version.
    annotate('error', `Could not read ${buildInfoUrl}: ${error.message}`);
    await fireDeployHook();
    return 1;
  }

  const differences = [
    ['rulesVersionId', expected.rulesVersionId, deployed.rulesVersionId],
    [
      'bundleSha256',
      expected.sha256.toLowerCase(),
      String(deployed.bundleSha256 ?? '').toLowerCase(),
    ],
    ['withdrawn', expected.withdrawn === true, deployed.withdrawn === true],
  ].filter(([, want, got]) => want !== got);

  if (differences.length === 0) {
    console.log(
      `In sync: the live site serves ${deployed.rulesVersionId} ` +
        `(withdrawn ${deployed.withdrawn === true}), which is the manifest's current version.`,
    );
    return 0;
  }

  annotate(
    'error',
    `The live site is out of date. The published manifest's current rules version is ` +
      `"${expected.rulesVersionId}" (withdrawn ${expected.withdrawn === true}), but ` +
      `${buildInfoUrl} reports "${String(deployed.rulesVersionId)}" ` +
      `(withdrawn ${deployed.withdrawn === true}).`,
  );
  for (const [field, want, got] of differences) {
    console.log(`  ${field}: expected ${String(want)}, deployed ${String(got)}`);
  }

  await fireDeployHook();

  annotate(
    'error',
    'A rebuild has been requested, but this run fails deliberately: the notification path did ' +
      'not work, and contract §4 requires that to be visible rather than quietly corrected.',
  );
  return 1;
}

process.exitCode = await main();
