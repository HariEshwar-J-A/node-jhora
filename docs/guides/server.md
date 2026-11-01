# Server deployment guide

This guide describes how to run **node-jhora** safely in multi-tenant HTTP servers, worker pools, and edge isolates. Calculations are **pure TypeScript** over JPL DE440s (and optional windowed NJCE chunks); there is **no WASM** and no Swiss Ephemeris in the package graph.

## Execution model

- **Synchronous and CPU-bound.** A full `ChartSession.collect()` (planets, houses, panchanga, D1–D60, Vimshottari dasha depth 3, shadbala, yogas, ashtakavarga) blocks the JavaScript isolate for on the order of **~25 ms p50** on typical server hardware today (see `pnpm run bench` and `packages/bench/baseline.json`). Dasha dominates that time; ephemeris is a few percent.
- **No internal `await` on the hot path** inside a chart calculation, so one in-flight chart monopolizes the event loop until it returns. For concurrent requests, use **multiple workers** (below), not overlapping async handlers on one engine.
- **Per-call options are request-safe.** Pass `ayanamsaOrder`, `precisionProfile`, `nodeType`, `positionMode`, `topocentric`, and related fields on each `getPlanets` / `getHouses` call (or via `ChartSession` settings resolved per session). You do not need `setAyanamsa()` per request if options are supplied on the call.

## What is not request-safe (process-wide or singleton state)

Audit these before sharing one Node process between tenants or concurrent requests.

| Mechanism                                 | Scope                                          | Risk if mutated mid-flight                                                                     | Source                                                                                  |
| ----------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `setIersEopTable(table)`                  | **Process global** (`activeTable`)             | Truth-profile UT1, GAST, polar motion use the registered table for all engines                 | `packages/core/src/engine/iers-eop.ts`                                                  |
| `EphemerisEngine#setIersEopTable`         | Delegates to the same global                   | Same as above                                                                                  | `packages/core/src/engine/ephemeris.ts`                                                 |
| `setDe441MeanNodeSampler(s)`              | **Process global**                             | Mean node path for DE441/NJCE dates                                                            | `packages/core/src/engine/de441-mean-lunar-node.ts` (updated from `setDe441ChunkStore`) |
| `setStarKinematicsProvider(fn)`           | **Process global**                             | True-star / geometric ayanamsa aberration inputs                                               | `packages/core/src/engine/ayanamsa.ts` (set during `initialize`)                        |
| `setEarthBarycentricDeProvider(fn)`       | **Process global**                             | Apparent True Citra / deflection helpers                                                       | `packages/core/src/engine/earth-geocenter-barycentric.ts` (set during `initialize`)     |
| `setBspBytesLoader(fn)`                   | **Process global**                             | Which bytes `initialize()` loads (Node register vs embed)                                      | `packages/core/src/engine/bsp-bytes-provider.ts`                                        |
| `loadSpkFromBytes` cache                  | **Process global** read-only SPK parse         | Safe after init; first loader wins until `resetSpkCache()`                                     | `packages/core/src/engine/spk.ts`                                                       |
| `EphemerisEngine.getInstance()`           | **One singleton per isolate**                  | Shared instance fields below                                                                   | `packages/core/src/engine/ephemeris.ts`                                                 |
| `setAyanamsa` / `setAyanamsaOptions`      | **Singleton (or instance) fields**             | Later calls see wrong sidereal frame if toggled between requests                               | `packages/core/src/engine/ephemeris.ts`                                                 |
| `setEphemerisPolicy`                      | **Instance field**                             | DE440s vs DE441 routing changes                                                                | `packages/core/src/engine/ephemeris.ts`                                                 |
| `setDe441ChunkStore`                      | **Instance field** + global mean-node sampler  | Chunk set and mean-node hook change                                                            | `packages/core/src/engine/ephemeris.ts`                                                 |
| `NodeJHora.calculate` / instance API      | Calls setters on **getInstance()** before work | Facade convenience mutates the singleton each call                                             | `packages/core/src/index.ts`                                                            |
| `@node-jhora/api` `getEngine()`           | **One engine** after `initEngine()`            | Same as singleton                                                                              | `packages/api/src/server.ts`                                                            |
| `aldebaranFrozenMeanCache`                | **Process global** memo                        | Stale Lahiri-style frozen mean if profile/mode changes rarely                                  | `packages/core/src/engine/ayanamsa.ts`                                                  |
| `withDeltaTContext` / `active` ΔT context | **Process global** during nested calls         | Engine wraps calls synchronously; **do not** call `deltaT()` from app code without the wrapper | `packages/core/src/engine/deltat.ts`                                                    |

**Recommended patterns**

1. **Configure once at startup:** EOP table (truth), ephemeris policy, DE441 chunk store, BSP loader. Never call the setters from per-request middleware.
2. **Prefer per-call `getPlanets` options** (and `ChartSession` settings per session) over `setAyanamsa` for request-specific ayanamsa.
3. **One engine per worker thread / isolate:** `new EphemerisEngine()` (or one `getInstance()` per worker) + `await initialize()`. Do not share a mutating singleton across concurrent worker tasks in the same thread without locking (there is no lock API).
4. **Edge:** `await engine.initialize({ kernel: de440sUint8Array })` after embedding or fetching the BSP; prefetch NJCE keys and `setDe441ChunkStore(createDe441ChunkStoreFromMemory(map))` before synchronous charts (ADR 0032).

## One engine per worker

| Host                   | Pattern                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**            | `node:worker_threads` — each worker runs `registerNodeBspLoaderFromCore()`, `new EphemerisEngine()`, `initialize()`, then serves charts. See `pnpm run bench:workers`. |
| **Bun**                | Same worker_threads model; run the bench with Bun if installed (`node scripts/bench-workers.mjs`).                                                                     |
| **Deno**               | `Worker` API with read permissions for `NODE_JHORA_EPHE_PATH` or pass `initialize({ kernel })`.                                                                        |
| **Cloudflare Workers** | One isolate per request or pooled isolates; each must call `initialize({ kernel })` (or reuse a warm isolate that already initialized). No filesystem BSP.             |

The library **does not** ship an internal worker pool — hosts own process layout and memory trade-offs.

## Cold start vs warm charts

| Phase                               | What to measure                                                   | Where                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Dynamic import + first `initialize` | ~40–90 ms init, ~80 ms first full chart (Node 22, DE440s on disk) | Server-grade plan §1.6; `ephemeris-init-cold` in `pnpm run bench`                                     |
| Warm full chart p50/p99             | Dominated by dasha until PR2 lands in your branch                 | `pnpm run bench` → `packages/bench/artifacts/bench-results.json` (`profileSplit`, `full-chart-jhora`) |
| Worker pool throughput              | charts/s, latency p50/p99, RSS                                    | `pnpm run bench:workers`                                                                              |

`pnpm run bench:check` fails only on **15% p50 regression** vs `baseline.json`. The **20 ms** full-chart budget is a **warning** (see `packages/bench/src/check-baseline.ts`).

## Memory footprint (DE440s, Node 22, this repo’s bench)

Figures from `pnpm run bench:workers` on Linux, Node v22.23.4, 4 CPUs, DE440s via `NODE_JHORA_EPHE_PATH` / offline cache (2026-11-01 VM run). **RSS is V8/OS reporting**, not a contractual limit; summing workers double-counts shared pages.

| Workers | charts/s | p50 ms | p99 ms | RSS after init (mean) | RSS after 30 charts (mean) |
| ------: | -------: | -----: | -----: | --------------------: | -------------------------: |
|       1 |     42.2 |  14.38 |  42.87 |                115 MB |                     174 MB |
|       2 |     81.5 |  15.17 |  48.99 |                253 MB |                     306 MB |
|       4 |    119.0 |  16.62 | 102.49 |                439 MB |                     493 MB |

The BSP contributes ~33 MB `arrayBuffers` plus parsed SPK metadata; each worker pays parse/mapping cost (BSP bytes are **not** shared across `worker_threads` isolates). For edge, embed only the 32 MB kernel (+ optional NJCE windows), not multi-GB century files.

Replace the table with fresh `pnpm run bench:workers` output when sizing production.

## Related documents

- [Architecture](../architecture.md) — ephemeris provider and packages
- [ADR 0033](../decisions/0033-server-grade-pr7-server-contract.md) — server contract decision
- [ADR 0032](../decisions/0032-server-grade-pr5-edge-long-range.md) — edge kernel and NJCE windows
- [ADR 0005](../decisions/0005-chartsession-worker-host.md) — browser ChartSession worker host (Comlink)
