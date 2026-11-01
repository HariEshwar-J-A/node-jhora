# ADR 0032: Server-grade PR5 — edge kernel and windowed NJCE

## Status

Accepted (server-grade PR5).

## Context

Edge runtimes (Workers, browser modules) cannot rely on Node `fs` or multi-gigabyte DE441 BSP files. Long-range dates need **windowed** `.njce` Chebyshev slices (record-range copies from DE441), not century monolith kernels. Synchronous `getPlanets` requires **`loadSync`** on chunk loaders; async-only `fetchChunkLoader` cannot populate the store on the hot path alone.

## Decision

1. **`inMemoryChunkLoader`** — synchronous loader over a `Map` of pre-fetched `.njce` bytes (embed, R2, KV, `fetch` completed before the chart).
2. **`De431ChunkStore.seedChunk`** — optional direct injection of parsed chunks.
3. **`chunkKeysForJdTdb` / `de441ChunkKeysForJdTdb`** — list NJCE keys for a TT window (±1 century, motion margin) so callers fetch only those files.
4. **`verifyingChunkLoader.loadSync`** — manifest SHA-256 on the sync path.
5. **`CachingChunkLoader.loadSync`** — delegate to inner sync loader with cache.
6. **`auto` ephemeris policy** unchanged: DE440s inside its JD span (byte-identical overlap); **`de441_long`** remains explicit for DE441-only charts.

## Consequences

- Edge bootstrap: `initialize({ kernel: de440sBytes })` + `setDe441ChunkStore(createDe441ChunkStoreFromMemory(map))` after prefetching keys from `de441ChunkKeysForJdTdb`.
- DE441 vs DE440s sidereal overlap at shared dates is **reported** in tests; kernels are not forced equal (~1e-8° class differences).
- Gates: PR5 identity tests in `packages/core/tests/engine/server-grade-pr5-edge.test.ts`; edge runtime via `pnpm run test:edge` (`tools/workerd/bench-sun-smoke.mjs`, Playwright fallback).

## References

- Server-grade plan §7 PR5
- ADR 0011 (DE440 / DE441 composite routing)
- `packages/ephe441/README.md` (windowed NJCE build)
