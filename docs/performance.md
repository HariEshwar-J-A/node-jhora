# Performance

Numbers come from `@node-jhora/bench` (`pnpm run bench` → `packages/bench/artifacts/bench-results.json`). Baselines are pinned in `packages/bench/baseline.json` (`schemaVersion` 2).

## Regression gate

`pnpm run bench:check` fails when any case’s **p50** regresses more than **15%** versus `baseline.json`. This gate is local/optional today; wire it into CI when baselines are owned by the release process.

## Warning budgets (do not fail `bench:check`)

| Case                                        | Baseline p50 (ms) | budgetMs |
| ------------------------------------------- | ----------------- | -------- |
| `full-chart-jhora` / `full-chart-warm-node` | **16.83**         | **20**   |
| `ephemeris-init-cold`                       | **42.87**         | **150**  |

Warm full-chart time is dominated by **Vimshottari dasha** (Decimal.js + Luxon), not ephemeris alone — see `profileSplit` in the bench artifact.

## Other baseline p50 samples (ms)

| Case                              | p50     |
| --------------------------------- | ------- |
| `planets-jhora`                   | 0.54    |
| `full-chart-truth`                | 15.89   |
| `full-chart-truth-plus-eop`       | 16.01   |
| `planets-truth-distinct-jd-first` | 21.0    |
| `deep-era-truth-mean-node-cold`   | 137.83  |
| `deep-era-truth-mean-node-warm`   | ~0.0002 |

Fixture: 2020-12-21 18:20 Asia/Kolkata (Varanasi, jhora12), `node-jhora-default`, dasha depth 3. Nine samples per case; full-chart cases use five warm-up iterations before sampling.

## Worker throughput

`pnpm run bench:workers` (`scripts/bench-workers.mjs`) measures **worker_threads** chart throughput and RSS per worker (PR7 server contract). Not an absolute CI gate; see [guides/server.md](./guides/server.md).

## Edge gate

`pnpm run test:edge` runs the workerd DE440s + NJCE smoke test (Playwright fallback). Documented in ADR 0032.
