# Cloudflare Workers / edge quickstart

Edge runtimes cannot read multi-gigabyte DE441 files from disk. Use:

1. `await engine.initialize({ kernel: de440sBytes })` for DE440s.
2. Prefetch windowed `.njce` chunks for long-range dates (`createDe441ChunkStoreFromMemory`, `de441ChunkKeysForJdTdb`).

Run the repo gate: `pnpm run test:edge` (workerd smoke; Playwright fallback).

See ADR [0032](../decisions/0032-server-grade-pr5-edge-long-range.md) and [guides/server.md](../guides/server.md).
