# Cross-library accuracy benchmark

Reproducible tooling (not published on npm) that compares geocentric **apparent** ecliptic longitudes and latitudes — tropical and Lahiri sidereal — against an independent JPL DE440 / DE441 truth reduction.

## Quick start

From the repository root (after a normal `pnpm install`):

```bash
pnpm build --filter @node-jhora/core
node bench/accuracy/run.mjs --quick
```

Full grids omit `--quick` (longer; downloads NAIF BSPs into `bench/accuracy/cache/` on first run).

Outputs:

| File                                    | Purpose                               |
| --------------------------------------- | ------------------------------------- |
| `bench/accuracy/REPORT.md`              | Human-readable max / RMS / p99 tables |
| `bench/accuracy/artifacts/results.json` | Machine-readable summaries + rankings |
| `bench/accuracy/artifacts/truth.json`   | Truth samples (regenerable)           |

## Libraries

| Library              | Role                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------- |
| **Truth**            | Skyfield apparent true ecliptic of date on DE440/DE441; ERFA gate <1 mas; nodes per ADR 0024 |
| **node-jhora**       | `@node-jhora/core`, apparent places, modern ΔT profile                                       |
| **pyswisseph**       | Black-box pip wrapper (no SE source read)                                                    |
| **Skyfield**         | Second pass; should match truth when ΔT is shared                                            |
| **astronomy-engine** | MIT npm ephemeris                                                                            |
| **astronomia**       | MIT analytic VSOP87 / lunar theory (Moshier-class short-span JS)                             |

Hosted chart APIs are documented as skipped unless a key-free endpoint is identified (see REPORT).

## ΔT

- **Shared:** `lib/deltat.json` (Espenak & Meeus segments) via `lib/build_deltat.py`
- **Native:** each library’s built-in ΔT (override disabled)

## Sources

See [ADR 0024](../../docs/decisions/0024-cross-library-accuracy-benchmark.md).
