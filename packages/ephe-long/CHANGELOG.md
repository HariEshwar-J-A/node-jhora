# @node-jhora/ephe-long

## 0.2.0

### Minor Changes

- 3697cf1: npm publish readiness (ADR 0006). Code packages ship only `dist` JS and type declarations, with no source maps, no data and no install scripts, and declare `engines.node >=22` and `{ types, import }` exports. `@node-jhora/core` adds a pinned SHA-256 manifest for DE440s and all 400 DE431 NJCE chunks (`@node-jhora/core` `ephemeris-data` exports), integrity-checking chunk loaders, the `@node-jhora/core/node/ephemeris` resolver (explicit path → installed package → cache → remote, with `NODE_JHORA_CACHE_DIR`, `NODE_JHORA_OFFLINE` and `NODE_JHORA_VERIFY`), and a `node-jhora-ephe` CLI (`where`, `prefetch`, `verify`). `@node-jhora/ephe` drops its `postinstall`, verifies the kernel at `prepack`, and adds type declarations and a provenance `NOTICE.md`; it is now an optional peer of core. `@node-jhora/ephe-long` no longer ships chunk data; the chunks are staged into 40 `@node-jhora/ephe-de431-*` data packages. Ephemeris output is unchanged.
- cd36dbe: Pluggable ephemeris providers: `CompositeEphemerisProvider` routes DE440s (1849–2150, default, unchanged output) and the optional DE431 long-range NJCE chunks (`@node-jhora/ephe-long`, built locally with `pnpm --filter @node-jhora/ephe-long build:chunks`). Adds the `ephemerisPolicy` setting (`auto` | `de440s` | `de431_long`), browser/Node chunk loaders, and proleptic Julian/Gregorian historical date helpers (`julianDayUt`, `civilDateFromJulianDay`). The API birth-date schema accepts astronomical years (year 0 = 1 BC).

### Patch Changes

- e04c0e8: Add commercial licensing contact to LICENSE section 4, align package metadata and README license sections, and add npm (Changesets + OIDC) and JSR publish pipelines with version sync checks.
