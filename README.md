<!-- AI-Assisted: Claude Code (model: claude-opus-5) - Repository README for the rules-reference
     site (task T003): what the site is, the unofficial/no-affiliation statement FR-023 requires,
     factual source attribution only, and the local loop from quickstart.md. -->
# wargame-rules-web

A public, read-only reference site that pre-renders one page per faction, per detachment and per
unit from the already-published curated rules bundle of
[`The-BadgerWorks/wargame-rules-data`](https://github.com/The-BadgerWorks/wargame-rules-data).

The site is statically generated at build time and deployed as plain files. There is no server-side
rendering, no database, no account, no cookie, no analytics, and no write path of any kind.

## Unofficial — no affiliation, no endorsement

**This is an unofficial fan project. It is not affiliated with, endorsed by, sponsored by, or
approved by Games Workshop.** Games Workshop owns the Warhammer 40,000 rules, names and artwork.
Every page of the generated site carries this statement.

## Source attribution

The site renders only the mechanical values and original, mechanics-only summaries contained in the
published bundle named by
`https://the-badgerworks.github.io/wargame-rules-data/manifest.json`. It adds no lore, no narrative
flavour, no publisher rules prose, no artwork and no imagery of miniatures. Nothing is rendered that
is not a field of that bundle or an entry of `src/chrome-strings.json`.

## Local development

```bash
npm ci
npm run dev              # astro dev; the verified bundle is cached under node_modules/.cache
npm test                 # vitest, against the synthetic fixtures in test/
npm run check            # astro check
npm run build            # astro check -> astro build -> node scripts/verify-dist.mjs
npm run preview          # serve dist/ locally
```

`npm run build` is the same command Cloudflare runs. If it fails, nothing is deployed and the
previously deployed build keeps serving — that is the whole rollback mechanism.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `WGC_WEB_CHANNEL` | `published` | Manifest channel to build from. A production build asserts `published` |
| `WGC_WEB_MANIFEST_URL` | the published `manifest.json` | Overridable; accepts an `https:` URL, a `file:` URL, or a local path (used to build against fixtures) |
| `WGC_WEB_SITE_URL` | the `*.workers.dev` address | Canonical base URL |
| `WGC_WEB_BRANCH` | Cloudflare's `WORKERS_CI_BRANCH`, else empty | Which branch is being built; `main` means a production build |

Build against the synthetic fixtures instead of the live manifest:

```bash
WGC_WEB_MANIFEST_URL=./test/fixtures/manifest-current.json npm run build
```

## Two rules contributors must not break

1. **Authored prose lives in exactly one file**, `src/chrome-strings.json`. Templates interpolate
   bundle values and reference chrome strings by key. A sentence typed directly into an `.astro`
   file is a policy violation, not a style nit, and `scripts/verify-dist.mjs` fails the build on it.
2. **Test fixtures are synthetic.** `test/fixtures/` holds hand-authored manifests and bundles with
   invented faction and unit names. No slice of the real published bundle is ever committed — not
   as a fixture, not as a golden file. The real bundle is fetched at build time and never enters
   git.

The fixture manifests carry the `sha256` and `sizeBytes` of the fixture bundle, and the build
verifies them. If a fixture bundle is edited, recompute both and update every fixture manifest that
names it.

## Repository layout

A pull request may touch **content** (`src/`, `public/`, `scripts/`, `test/`, `e2e/`) **or**
**configuration** (`wrangler.jsonc`, `.github/`, `docs/`), not both; CI refuses a pull request that
mixes them, and configuration changes require a non-author reviewer (`.github/CODEOWNERS`).

Cloudflare Workers Builds settings that have no in-repo representation are recorded as declared
desired state in [`docs/cloudflare-settings.md`](docs/cloudflare-settings.md).

## Specifications

The feature specification, plan, research, rebuild contract and quickstart live in
`specs/003-rules-reference-web/` of the private `The-BadgerWorks/WargameCompanion` repository.
