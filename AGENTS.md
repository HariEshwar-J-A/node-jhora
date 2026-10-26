# AGENTS.md

Instructions for coding agents in this repository.

`CLAUDE.md` is listed in `.gitignore` under `# AI` and is not a tracked file. Do not un-ignore it. This file is the tracked agent guide.

## Layout

pnpm workspaces (`packages/*` and `apps/*` in `pnpm-workspace.yaml`), ESM, TypeScript project references. Root scripts are in the root `package.json`. pnpm is pinned via `packageManager`; enable it with Corepack (`corepack enable` then `corepack prepare --activate`).

| Path        | What belongs here                                                                                                                                                                          |
| :---------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/` | Libraries. One package per directory. Public imports go through each package's `exports`.                                                                                                  |
| `apps/`     | Applications. `apps/docs` is the Starlight documentation site. A React UI app is planned here. Libraries must not depend on `apps/`. Application code must not be added under `packages/`. |
| `docs/`     | Technical documentation.                                                                                                                                                                   |
| `tools/`    | Maintenance scripts: Markdown link check, clean-room asset guard, tsconfig-reference test.                                                                                                 |

Current libraries: `core`, `ephe` (DE440s data only), `analytics`, `prediction`, `match`, `events`, `reporting`, `engine` (ChartSession facade), `api`, `format` (.njh chart files), private `testkit` (golden-case schema), and private `bench` (performance budgets). Dependency edges are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Engine facts to keep intact

Verified in source. Do not document a different engine or a different default ayanamsa.

- Ephemeris: pure TypeScript JPL DE440s SPK reader (`packages/core/src/engine/ephemeris.ts`) and `@node-jhora/ephe`. No Swiss Ephemeris dependency and no WASM binary.
- Kernel coverage recorded in `packages/ephe/download.mjs` and the engine header: **1849-12-26 to 2150-01-22**. `SpkFile.getState` throws when no Type-2 segment covers the time.
- Default ayanamsa: `AYANAMSA.TRUE_CITRA` (`27`), True Chitrapaksha. `DEFAULT_CONFIG.ayanamsaMode` is the same value. `NodeJHora.calculate` defaults the name argument to `'TrueChitra'`. The API schema defaults to `'true_chitra'`.
- `getAyanamsa` uses mode 27 when the mode is absent from `AYANAMSA_MODELS`. Mode `2` (`LAHIRI_ICRC`) is such a mode.
- `EphemerisEngine.getHouses` computes Equal cusps only for method `'E'`. Any other method gets Whole Sign cusps.

## Commands

From the repository root:

```bash
corepack enable && corepack prepare --activate
pnpm install --frozen-lockfile
pnpm build             # turbo run build — each package runs tsc; graph in turbo.json (dependsOn ^build)
pnpm typecheck         # turbo run typecheck — dependsOn ^build (reads dependency dist/)
pnpm test              # turbo run test — one Jest project per library package; @node-jhora/ephe runs tools/ suites
pnpm generate          # turbo run generate — @node-jhora/testkit WRITE_GOLDENS (schema + core *.golden.json)
pnpm --filter @node-jhora/core test
pnpm run check:links   # relative Markdown links, no network
pnpm run check:browser-bundle  # @node-jhora/core/browser gzip budget (excl. de440s.bsp)
pnpm run test:browser  # Playwright worker parity (apps/browser-harness)
pnpm run check:clean-room  # forbidden binaries/help files, stray .jhd charts, decompiler markers
pnpm run check:licenses    # no AGPL/GPL in production dependency graph
pnpm run validate-github-templates
pnpm run docs:build   # Starlight site in apps/docs (standalone; not part of the turbo graph, which is filtered to packages/*)
pnpm run docs:dev
pnpm run bench        # performance suites → packages/bench/artifacts/bench-results.json
pnpm run bench:check  # fail on >15% regression vs packages/bench/baseline.json
```

Task graph and cache inputs live in `turbo.json`. `@node-jhora/ephe#test` lists `$TURBO_ROOT$/tools/**` so edits under `tools/` invalidate that cache entry. `@node-jhora/core#build` restores `src/generated/build-constants.ts` from cache alongside `dist/**`. Regenerated artifacts (`packages/testkit/schema/**`, `packages/core/tests/fixtures/*.golden.json`) are declared on `@node-jhora/testkit#generate`.

Library packages (`core`, `analytics`, `prediction`, `match`, `engine`, `events`, `reporting`, `api`, `format`, `testkit`, `bench`) share one script shape:

| Script      | Shape                                                                                        |
| :---------- | :------------------------------------------------------------------------------------------- |
| `build`     | `tsc`                                                                                        |
| `typecheck` | `tsc --noEmit --pretty false`                                                                |
| `lint`      | `eslint .`                                                                                   |
| `test`      | `node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --config jest.config.js` |

`typecheck` reads referenced projects from `dist/`. Run `pnpm build` first. A task runner must run `^build` before `typecheck`.

`@node-jhora/ephe` is DE440s data only: no `tsconfig.json` and no unit tests. `build` and `typecheck` exit 0. `lint` is the same placeholder. `test` runs the repo-level suites that are not a library package (`tools/jest.config.js` and `node --test tools/check-forbidden-assets.test.mjs`). Root `pnpm test` is `turbo run test` across workspace packages; the sum of per-package Jest totals plus the seven `node:test` guard cases from `@node-jhora/ephe` matches what the old root Jest multi-project run reported (no double counting). The kernel is not in git. The root `postinstall` and the package's `prepack` run `packages/ephe/download.mjs`, which skips the download when `de440s.bsp` already matches the pinned SHA-256. The published package has no install scripts (ADR 0006).

Root `pnpm run lint` runs `turbo run lint --filter=./packages/*`, i.e. `eslint .` in every workspace package (cached per package). Rule set: [docs/LINT.md](docs/LINT.md).

Internal dependencies use `workspace:*`. There is no `.npmrc`: pnpm's isolated `node_modules` is unchanged. pnpm 12 records dependency lifecycle-script decisions in `allowBuilds` inside `pnpm-workspace.yaml`.

Call `await EphemerisEngine.getInstance().initialize()` before planetary calculations. The kernel is `NODE_JHORA_EPHE_PATH`, then `@node-jhora/ephe`, then the monorepo copy, then the user cache, then a SHA-256-verified download from JPL into that cache (skipped when `NODE_JHORA_OFFLINE=1`) (`packages/core/node/ephemeris.mjs`).

## Git and pull requests

- Never push to `main`. Open a pull request.
- One task per pull request. Do not mix an unrelated behaviour change into a docs change.
- Branch: `<type>/<ID>-<slug>`. `type` is `feat`, `fix`, `chore`, `test`, `docs`, `refactor`, or `perf`. Example: `chore/E1-S1-T3-reconcile-stale-docs-with-code-readme-cl`.
- Pull request title: `type(scope): summary [ID]`. Example: `chore(repo): Reconcile stale docs with code (README, CLAUDE.md) [E1-S1-T3]`.

## Clean-room rule

Do not add Jagannatha Hora (JHora) source code, help text, icons, fonts, or other assets. JHora numbers may be used only as test oracles. Full policy: [docs/CLEAN_ROOM.md](docs/CLEAN_ROOM.md). Contribution rules: [CONTRIBUTING.md](CONTRIBUTING.md).
