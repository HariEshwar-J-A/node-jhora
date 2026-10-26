# Pure-TypeScript DE440s ephemeris in core

- Status: accepted
- Date: 2026-10-26
- Deciders: maintainers

Technical story: E22-S2-T1 (records the engine choice already in the tree)

## Context and Problem Statement

Sidereal longitudes need a planetary ephemeris. Swiss Ephemeris is the usual
library in this field and is what JHora uses, but it is AGPL-3.0. Which
ephemeris does `@node-jhora/core` ship?

## Decision Drivers

- A network API built on AGPL code inherits AGPL obligations.
- Astrometry must be checkable against a public source (JPL Horizons).
- The core package stays pure TypeScript: no WASM, no native addon.

## Considered Options

- Swiss Ephemeris (native or WASM) as a runtime dependency of core.
- A pure-TypeScript reader for the JPL DE440s SPK kernel, distributed as data
  by `@node-jhora/ephe`.
- A low-precision series (VSOP-style) with no kernel.

## Decision Outcome

Chosen option: "pure-TypeScript DE440s", because the kernel is U.S. Government
public-domain data and the reader is our code. `@node-jhora/core` does not
depend on Swiss Ephemeris. Coverage is 1849-12-26 through 2150-01-22; outside
that range the engine fails explicitly rather than extrapolating.

Swiss Ephemeris may be invoked only as an external oracle from a developer or
CI script that does not ship with a published package. Its documentation may
be cited with provenance, as described in
[docs/CLEAN_ROOM.md](../CLEAN_ROOM.md). Its source and data files are not
vendored.

### Consequences

- Good, because the published packages stay clear of AGPL.
- Good, because Horizons can pin astrometry without involving JHora.
- Bad, because dates outside 1849–2150 need a later ephemeris package (the
  roadmap's optional DE441), not Swiss Ephemeris inside core.

## Pros and Cons of the Options

### Swiss Ephemeris as a dependency

- Good, because it matches JHora's library and covers a very long date range.
- Bad, because AGPL would apply to services built on the engine.

### DE440s read in TypeScript

- Good, because the licence is public domain and the implementation is ours.
- Bad, because the short kernel does not cover remote historical dates.

### Low-precision series only

- Good, because there is no data file to download.
- Bad, because arcminute-level error is not enough for varga boundaries.

## More Information

Data notes: `packages/ephe/README.md`. Accuracy method: `docs/ACCURACY.md`.
A longer date range is backlog E3-S4, not a reason to link Swiss Ephemeris
into core.
