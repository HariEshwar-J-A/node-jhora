# 5. ChartSession worker and SharedWorker host

Date: 2026-10-26

## Status

proposed

## Context

The browser UI must run the full Jyotish engine without a backend (E15+). Heavy
chart work must stay off the main thread. `@node-jhora/engine` exposes
`ChartSession` with lazy, memoised sections and plain-object results suitable for
`structuredClone` / `postMessage`.

## Decision

1. **Host process:** A dedicated Web Worker (or SharedWorker when multiple tabs
   should share one ephemeris load) owns a single `EphemerisEngine` instance and
   a map of `ChartSession` keyed by `(settingsHash, birth instant, place)`.
2. **Protocol:** The main thread sends `{ type: 'collect', sessionKey, include: ChartSectionId[] }`.
   The worker replies with `{ type: 'sections', sessionKey, payload: ChartSectionsSnapshot }`.
   Initialise ephemeris once per worker with `{ type: 'init' }` after loading
   `de440s.bsp` from IndexedDB or a bundled slice (same resolution order as Node:
   env override is N/A in browser; package path or fetch).
3. **No Node APIs in the worker bundle:** Only `@node-jhora/engine` and its
   dependencies are linked; Fastify and `fs` stay out. Comlink or a thin message
   wrapper is acceptable; the worker build itself is **E14-S1-T2**.
4. **Envelope:** When `packages/core/src/envelope.ts` lands, the worker wraps
   `ChartSectionsSnapshot` in the standard result envelope before `postMessage`.

## Consequences

- API and UI share identical section semantics and settings hashing.
- One SharedWorker amortises DE440s parse cost across tabs; fallback Worker per tab
  remains valid for simpler deployments.
- E14-S1-T2 implements the bundler entry, Comlink surface, and browser ephemeris
  bootstrap tests.
