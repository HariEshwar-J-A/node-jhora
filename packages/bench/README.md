# @node-jhora/bench

Performance budgets and regression gates for `ChartSession`, engine primitives, and ephemeris initialization.

## Budgets (warning only)

| Case                                                                        | Budget     |
| --------------------------------------------------------------------------- | ---------- |
| Full chart warm, jhora (`full-chart-jhora` / legacy `full-chart-warm-node`) | 20 ms p50  |
| Ephemeris init cold (`ephemeris-init-cold`)                                 | 150 ms p50 |

The 20 ms full-chart budget is a **warning only** (does not fail `bench:check`). Warm full-chart p50 is dominated by **Vimshottari dasha** (Decimal.js + Luxon), not ephemeris or vargas alone — see `profileSplit` in `artifacts/bench-results.json`.

## Regression gate (fails CI)

`bench:check` fails when any case’s **p50** regresses more than **15%** versus `baseline.json`. Example: baseline p50 = 100 ms → measured 120 ms fails; 114 ms passes.

## Artifact (`schemaVersion` 2)

`pnpm run bench` writes `packages/bench/artifacts/bench-results.json` with:

- **p50**, **p99**, **RSS (MB)** per case
- **`profileSplit`**: full chart, planets, houses, ayanamsa for `jhora`, `modern`, `truth`, and `truth+eop`
- **Distinct-JD truth planets**: 40 dates, 3-day step — first pass and second pass (guards one-slot memo cheats)
- **Deep-era truth mean node** (y-10000, DE441 secular): cold and warm when NJCE441 chunks are available
- Legacy alias `full-chart-warm-node` (= `full-chart-jhora`)

## Commands

From the monorepo root (after `pnpm build`):

```bash
pnpm run bench          # write artifacts/bench-results.json
pnpm run bench:check    # re-run benches; fail on >15% p50 regression vs baseline.json
pnpm run bench:workers  # worker_threads throughput + RSS (not an absolute CI gate)
```

Nine samples per case; full-chart cases use five warm-up iterations before sampling. Chart fixture: 2000-01-01 12:00 Asia/Kolkata, `node-jhora-default`, dasha depth 3.
