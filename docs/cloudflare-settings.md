<!-- AI-Assisted: Claude Code (model: claude-opus-5) - Declared desired state for the Cloudflare
     Workers Builds git-integration settings and the GitHub branch protection that together form
     this feature's deploy gate (task T005), recorded as the reviewable source of truth for the
     Principle 5 exception documented in plan.md's Infrastructure gate. -->
# Cloudflare Workers Builds — declared desired state

**Status**: declared desired state. **This document is the source of truth**, not the dashboard.

Everything on this page is dashboard state with no in-repo representation. `plan.md`'s
*Constitution Check → Infrastructure gate* records this as a documented **Principle 5 exception**:
the deployment surface that *can* be code is code (`wrangler.jsonc`, `.github/workflows/`,
`package.json`), and what remains is here.

**There is deliberately no automated drift check.** Reading these settings back requires a
Cloudflare API token with account read access — the exact credential research D3 chose Workers
Builds in order to avoid holding in GitHub. A standing token is a larger risk than the drift it
would detect. The compensating controls are that the setting count is small, each is echoed at the
top of every build log, and a wrong build command fails the verification step rather than deploying.

Review date: the first release-cycle review after launch.

## 1. Workers Builds git integration

| Setting | Declared value |
|---|---|
| Cloudflare account | The-BadgerWorks |
| Worker name | `wargame-rules-web` (must match `name` in `wrangler.jsonc`) |
| Connected repository | `The-BadgerWorks/wargame-rules-web` |
| Production branch | `main` |
| Non-production branch builds | **on** — every branch and pull request gets a build and a preview URL |
| Root directory | `/` (repository root) |
| Build command | `npm ci && npm run build` |
| Deploy command (production) | `npx wrangler deploy` |
| Deploy command (non-production) | `npx wrangler versions upload` |
| Build variables | none required |
| Build secrets | none — **no Cloudflare API token exists in GitHub for this project** |

`npm run build` expands to `astro check && astro build && node scripts/build-info.mjs && node
scripts/verify-dist.mjs`. Because the
verification script is part of the build command rather than a separate stage, a failing check means
the deploy command never runs, no version is created, and the previous deployment keeps serving.
That is the entire rollback mechanism for a failed build; nothing is required of an operator.

## 2. Deploy hook

| Property | Declared value |
|---|---|
| Exists | yes, one hook |
| Bound branch | `main` |
| URL shape | `https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/<DEPLOY_HOOK_ID>` |
| Credential | the id embedded in the URL — **the URL is the secret**; there is no header and no body |
| Stored in `wargame-rules-web` as | GitHub Actions secret `CF_DEPLOY_HOOK_URL` (used only by `manifest-watch.yml`) |
| Stored in `wargame-rules-data` as | GitHub Actions secret `WGC_REBUILD_HOOK_URL` (used only by the notification step) |

Semantics, the exact producer step, and the non-interference guarantees are frozen in
`specs/003-rules-reference-web/contracts/rebuild-notification.md` v1.0.0.

**Rotation**: delete the hook, recreate it against `main`, then update **both** secrets. A stale URL
fails silently by design, so rotation is safe under pressure but must be paired with the manifest
watch, which is what makes the resulting staleness visible.

### The manifest watch's own settings

`.github/workflows/manifest-watch.yml` runs every 6 hours and on `workflow_dispatch`, and needs one
repository **variable** besides the secret above:

| Name | Kind | Declared value |
|---|---|---|
| `WGC_WEB_SITE_URL` | repository variable | the deployed base URL, e.g. `https://<worker>.workers.dev` |

Until it is set the watch warns and exits successfully, because the public hostname is still
undecided (research *Open items* #3) and a guessed one would report a permanent, meaningless
divergence. **Setting this variable is what turns the watch on**; the site is unmonitored without
it. The same value is also the build-time `WGC_WEB_SITE_URL` that produces canonical URLs.

## 3. Preview URLs

| Setting | Declared value |
|---|---|
| `workers_dev` subdomain | enabled |
| `preview_urls` | default (follows `workers_dev`) |

If the `workers.dev` subdomain is ever disabled in favour of a custom domain, `"preview_urls": true`
must be set explicitly in `wrangler.jsonc` or preview builds silently stop being reachable
(research D3, caveat 3). Preview URLs are publicly addressable, which is why a non-production build
emits `<meta name="robots" content="noindex">`.

## 4. GitHub branch protection on `main`

Workers has **no deployment protection or required-approval feature** — a push to the production
branch deploys. The production deploy gate is therefore on the GitHub side:

| Setting | Declared value |
|---|---|
| Require a pull request before merging | on |
| Required approvals | 1 |
| Dismiss stale approvals on new commits | on |
| Require review from Code Owners | on (this is what makes `.github/CODEOWNERS` load-bearing) |
| Require status checks to pass | on — `verify`, `path-exclusivity`, `actionlint` from `.github/workflows/ci.yml` |
| Require branches to be up to date before merging | on |
| Allow force pushes / deletions | off |

**The split this enforces, stated plainly**: the review gates *changes to the site*. *Refreshes of
the data* are unattended by design — FR-025 requires the rebuild to be automatic and SC-005 caps it
at 60 minutes, and the human gate for that content already happened upstream in `002`'s
reviewer-approved publish. Do not add an approval step to the deploy-hook path.

## 5. Build environment assumptions

| Assumption | Why it is recorded here |
|---|---|
| Node 22.18 or newer on the build image | Astro 7 requires Node 22; 22.18 is where node strips TypeScript types on import without a flag, which is how `scripts/build-info.mjs` and `scripts/verify-dist.mjs` read `src/data/bundle.ts` instead of re-deriving the rules version and the route set. `package.json` declares `engines.node >= 22.18` |
| `WORKERS_CI_BRANCH` is set by Workers Builds to the branch being built | `src/config.ts` compares it against `main` to decide whether this is a production build, which is how the `WGC_WEB_CHANNEL === 'published'` assertion (FR-002) and the `noindex` on preview builds are decided. `WGC_WEB_BRANCH` overrides it if the variable is ever renamed upstream |
| `WORKERS_CI_COMMIT_SHA` is set by Workers Builds | recorded into `dist/build-info.json` as `builtFromCommit` for the rebuild-notification contract; falls back to `git rev-parse HEAD` |

## 6. Break-glass

A dashboard-side manual deploy or rollback under pressure is permitted. It **must** be documented
after the fact with reason, actor, time, affected version, and remediation — where remediation is
landing the equivalent change in git and rebuilding, so this document and the deployed reality agree
again.
