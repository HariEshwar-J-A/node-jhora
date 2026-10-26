# @node-jhora/bench

Performance budgets and regression gates for `ChartSession` and ephemeris initialization.

## Budgets

| Case | Budget |
| --- | --- |
| Full chart warm (Node) | 20 ms median |
| Ephemeris init cold (fresh Node process) | 150 ms median |
| Full chart in browser worker | 40 ms (documented; hook via `registerBrowserWorkerBenchHook`) |

Workloads: D1–D60 vargas, Vimshottari dasha depth 3, shadbala, yogas, ashtakavarga, and core sections via `ChartSession.collect`.

## Commands

From the monorepo root (after `pnpm build`):

```bash
pnpm run bench          # write packages/bench/artifacts/bench-results.json
pnpm run bench:check    # re-run and fail on >15% regression vs baseline.json
```

Each case uses the median of nine samples. `bench:check` reports budget misses without weakening targets.
