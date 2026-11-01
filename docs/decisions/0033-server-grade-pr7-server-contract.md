# ADR 0033: Server-grade PR7 — server contract and worker bench

## Status

Accepted (server-grade PR7).

## Context

Multi-tenant servers and edge isolates need a clear contract: calculations are synchronous, several APIs mutate **process-global** or **singleton** state, and throughput scaling is achieved with **one `EphemerisEngine` per worker**, not a shared singleton under concurrent load. Stale docs still referred to a “Singleton WASM engine.”

## Decision

1. Publish **[docs/guides/server.md](../guides/server.md)** — execution model, non-request-safe setters (with file references), worker patterns (Node/Bun/Deno/Workers), cold vs warm costs (pointing at `@node-jhora/bench`), and RSS guidance.
2. Add **`pnpm run bench:workers`** — throughput and latency for 1 / 2 / 4 / N workers using `node:worker_threads`; optional Bun/Deno via `scripts/bench-workers.mjs`. Not a CI gate on absolute charts/s.
3. Add **worker_threads identity test** — concurrent workers must produce the same bench-chart combined SHA-256 as single-threaded output (guards cross-request leakage).
4. Replace inaccurate WASM singleton comments in `@node-jhora/api` and core/API docs with the DE440s TypeScript engine description.

No calculation or API behavior changes in this ADR.

## Consequences

- Operators configure EOP, policy, and chunk stores at process/worker startup; per-request work uses call options or per-session `ChartSession` settings.
- PR4 instance-level memos (ADR 0030) must not reintroduce module-global caches for nutation/precession.
- Gates: existing tests green; smoke test runs `bench-workers` in CI smoke mode.

## References

- Server-grade plan §6–§7 PR7
- ADR 0005 (ChartSession worker host)
- ADR 0032 (edge `initialize({ kernel })`)
