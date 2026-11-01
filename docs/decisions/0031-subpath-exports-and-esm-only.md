# ADR 0031: `@node-jhora/core` subpath exports (PR6)

## Status

Accepted (2026-03-29).

## Context

Server-grade packaging (research plan §4–§7, PR6) requires real subpath entry
points for leaf modules, accurate `sideEffects` for bundlers, and gzip budgets
on those leaves. Consumers asked for CommonJS `require()`; the published surface
has been ESM-only (`import` condition, no `require`).

A **planets-only** entry that omits the IAU 2000A nutation JSON is only viable when
`EphemerisEngine.getPlanets` for the jhora geometric profile does not statically
import that series. Today `ephemeris.ts` imports `nutation.js` (and transitively
`nutation-iau2000a.data.json`) for house, rise/set, and modern/truth paths on the
same class. Splitting that graph without duplicating the engine is deferred to
PR4/PR5 work on caches and edge loaders.

## Decision

1. **Subpaths** — Publish stable export map entries:
    - `@node-jhora/core/chebyshev` → `dist/engine/chebyshev.js`
    - `@node-jhora/core/vargas` → `dist/vedic/vargas.js`

2. **`sideEffects`** — Explicit list (not package-wide `false`):

    - `./dist/index.js` — constructs `defaultEphemeris` at load.
    - `./dist/engine/provider/chunk-loader.js` — top-level async `fs`/`path` import.
    - `./dist/ephemeris-data/manifest.js` and `./dist/ephemeris-data/manifest.de441.js` —
      populate chunk indexes at load.

    Leaf subpaths (`chebyshev`, `vargas`) do not import those modules. Decimal
    configuration uses `Decimal.clone({ precision: 34, rounding: ROUND_HALF_EVEN })`
    in `core/precise.ts`, exported as `Decimal` from `@node-jhora/core`. Downstream
    packages must not import bare `decimal.js` (eslint `no-restricted-imports`).

3. **Bundle gates** — `scripts/check-core-subpath-bundles.mjs` (wired into
   `pnpm check:browser-bundle`) enforces minified browser gzip ≤ 2 KiB (chebyshev)
   and ≤ 8 KiB (vargas). The existing browser entry budget stays 150 KiB gzip.

4. **CommonJS** — No dual CJS build in this PR. Node 22+ consumers use `import`.
   `packages/core/tests/node/cjs-require.test.ts` asserts `createRequire()` against
   the package name still yields `ERR_PACKAGE_PATH_NOT_EXPORTED` until a future
   dual emit lands with attw/publint coverage.

5. **Planets-only entry** — Not added. Full barrel gzip is unchanged (~281 KiB raw
   for `EphemerisEngine` import per research); do not claim a smaller engine import
   until the nutation series is split off the jhora geometric planet path.

## Consequences

- Good: Edge and app bundlers can import Chebyshev or varga math without pulling
  the full `@node-jhora/core` barrel.
- Good: `sideEffects` list matches real load-time work; varga/chebyshev bundles
  stay safe for tree-shaking without relying on global `decimal.js` mutation.
- Neutral: Root import still pulls nutation JSON; houses and truth/modern profiles
  need the full entry.
- Bad: CommonJS callers must stay on dynamic `import()` or migrate to ESM.

## Verification

- `pnpm check:browser-bundle` (browser + subpath gzip)
- `pnpm check:pack` (publint strict + attw esm-only)
- Golden suites unchanged (hex-identical outputs)
- `packages/core/tests/package/bundle-tree-shake-parity.test.ts` — esbuild
  minified bundles for chebyshev, vargas, and browser entries vs Node digests
  (≥50 longitudes × all standard divisions, sign boundaries)
