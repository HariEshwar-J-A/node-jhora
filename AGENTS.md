# AGENTS.md

Instructions for coding agents in this repository.

`CLAUDE.md` is listed in `.gitignore` under `# AI` and is not a tracked file. Do not un-ignore it. This file is the tracked agent guide.

## Layout

npm workspaces (`packages/*`), ESM, TypeScript project references. Root scripts are in the root `package.json`.

| Path | What belongs here |
| :--- | :--- |
| `packages/` | Libraries. One package per directory. Public imports go through each package's `exports`. |
| `apps/` | Applications. **Nothing is checked in today.** A React UI app is planned here. Libraries must not depend on `apps/`. Application code must not be added under `packages/`. |
| `docs/` | Technical documentation. |
| `tools/` | Maintenance scripts: Markdown link check, clean-room asset guard, tsconfig-reference test. |

Current libraries: `core`, `ephe` (DE440s data only), `analytics`, `prediction`, `match`, `events`, `reporting`, `api`. Dependency edges are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

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
npm install
npm run build          # tsc -b — root references: core, analytics, prediction, match, api, events, reporting
npm test               # Jest projects: packages/*/jest.config.js and tools/jest.config.js, then node --test tools/check-forbidden-assets.test.mjs
npx jest --config packages/core/jest.config.js
npm run check:links    # relative Markdown links, no network
npm run check:clean-room  # forbidden binaries/help files, stray .jhd charts, decompiler markers
```

`npm run lint` calls ESLint, which is not a root `devDependency`.

Call `await EphemerisEngine.getInstance().initialize()` before planetary calculations. The kernel is `NODE_JHORA_EPHE_PATH`, else `@node-jhora/ephe`, else `de440s.bsp` beside `packages/`.

## Git and pull requests

- Never push to `main`. Open a pull request.
- One task per pull request. Do not mix an unrelated behaviour change into a docs change.
- Branch: `<type>/<ID>-<slug>`. `type` is `feat`, `fix`, `chore`, `test`, `docs`, `refactor`, or `perf`. Example: `chore/E1-S1-T3-reconcile-stale-docs-with-code-readme-cl`.
- Pull request title: `type(scope): summary [ID]`. Example: `chore(repo): Reconcile stale docs with code (README, CLAUDE.md) [E1-S1-T3]`.

## Clean-room rule

Do not add Jagannatha Hora (JHora) source code, help text, icons, fonts, or other assets. JHora numbers may be used only as test oracles. Full policy: [docs/CLEAN_ROOM.md](docs/CLEAN_ROOM.md). Contribution rules: [CONTRIBUTING.md](CONTRIBUTING.md).
