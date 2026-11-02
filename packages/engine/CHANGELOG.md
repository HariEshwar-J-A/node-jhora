# @node-jhora/engine

## 3.2.0

### Minor Changes

- 3d83d2b: Add browser and Web Worker builds: `@node-jhora/core/browser`, `@node-jhora/engine/browser` (plus `worker-entry` / `worker-api`), and a browser-safe `@node-jhora/ephe/constants.mjs`. Worker results use a lossless wire format (no float32 quantization) and match Node within 2e-8″ in Chromium, Firefox and WebKit.

### Patch Changes

- 79b830c: Add the `Body` enum (Rahu = 10, Ketu = 99) and use it across packages. `EphemerisInterpolator.unpack()` now reports node ids 10/99 (was 8/9), matching `getPlanets()`. KP significators keep legacy 7/8.
- 0431d00: Interpret civil dates before 1582-10-15 as Julian by default (JHora / Swiss Ephemeris), with optional `calendar` setting (`auto` | `gregorian` | `julian`). Birth API routes resolve civil time through the shared resolver so Julian leap days (e.g. 1500-02-29) work.
- b4c9682: Add `deltaTForecast` on calculation settings (`'published' | 'oracle-compat'`, default `'published'`) for the modern ΔT post-bridge path. `'oracle-compat'` preserves the legacy in-house curve used by pyswisseph 2.10 test oracles; `'published'` uses UKHO lod integration and SMH2016 eq. 4.1. Envelope `deltaTModel` ids now name the active forecast.
- 3697cf1: npm publish readiness (ADR 0006). Code packages ship only `dist` JS and type declarations, with no source maps, no data and no install scripts, and declare `engines.node >=22` and `{ types, import }` exports. `@node-jhora/core` adds a pinned SHA-256 manifest for DE440s and all 400 DE431 NJCE chunks (`@node-jhora/core` `ephemeris-data` exports), integrity-checking chunk loaders, the `@node-jhora/core/node/ephemeris` resolver (explicit path → installed package → cache → remote, with `NODE_JHORA_CACHE_DIR`, `NODE_JHORA_OFFLINE` and `NODE_JHORA_VERIFY`), and a `node-jhora-ephe` CLI (`where`, `prefetch`, `verify`). `@node-jhora/ephe` drops its `postinstall`, verifies the kernel at `prepack`, and adds type declarations and a provenance `NOTICE.md`; it is now an optional peer of core. `@node-jhora/ephe-long` no longer ships chunk data; the chunks are staged into 40 `@node-jhora/ephe-de431-*` data packages. Ephemeris output is unchanged.
- e04c0e8: Add commercial licensing contact to LICENSE section 4, align package metadata and README license sections, and add npm (Changesets + OIDC) and JSR publish pipelines with version sync checks.
- Updated dependencies [80afc7b]
- Updated dependencies [79b830c]
- Updated dependencies [3d83d2b]
- Updated dependencies [0431d00]
- Updated dependencies [f361f1b]
- Updated dependencies [7722bb5]
- Updated dependencies [6aadd82]
- Updated dependencies [772ab80]
- Updated dependencies [b4c9682]
- Updated dependencies [58542a2]
- Updated dependencies [d7af2ae]
- Updated dependencies [0b65237]
- Updated dependencies [c1d00ed]
- Updated dependencies [2ad5f40]
- Updated dependencies [fd22685]
- Updated dependencies [148c15d]
- Updated dependencies [389d0e6]
- Updated dependencies [b2d83b8]
- Updated dependencies [2a88884]
- Updated dependencies [2a0debc]
- Updated dependencies [aae9e43]
- Updated dependencies [3697cf1]
- Updated dependencies [cd36dbe]
- Updated dependencies [e04c0e8]
- Updated dependencies [0d8062c]
- Updated dependencies [aa42f56]
- Updated dependencies [e9cf6ad]
- Updated dependencies [e5803cb]
- Updated dependencies [7c499a1]
- Updated dependencies [72f3bd7]
    - @node-jhora/core@4.0.0
    - @node-jhora/analytics@3.1.1
    - @node-jhora/prediction@3.1.1

## 3.1.0

Release notes before per-package changelogs are recorded in the [repository CHANGELOG](../../CHANGELOG.md).
