# @node-jhora/engine

Lazy, memoised **ChartSession** facade over `@node-jhora/core`, `@node-jhora/analytics`, and `@node-jhora/prediction`. Intended for the HTTP API, browser UI, and Web Worker hosts.

- Sections (`planets`, `houses`, `panchanga`, `vargas`, `dasha`, `shadbala`, `yogas`, `ashtakavarga`) compute only when requested.
- Results are plain JSON-friendly objects (no class instances in section payloads).
- No Node-only APIs in this package; ephemeris I/O stays in `core`.

```typescript
import { DateTime } from 'luxon';
import { EphemerisEngine } from '@node-jhora/core';
import { ChartSession } from '@node-jhora/engine';

const eph = EphemerisEngine.getInstance();
await eph.initialize();

const session = new ChartSession({
    instant: DateTime.fromISO('2020-12-21T18:20:00', { zone: 'Asia/Kolkata' }),
    location: { latitude: 25.3176, longitude: 82.9739 },
    settings: 'node-jhora-default',
    ephemeris: eph,
});

const planets = session.getPlanets();
const slice = session.collect(['houses', 'panchanga']);
```

Worker packaging is described in [docs/decisions/0005-chartsession-worker-host.md](../../docs/decisions/0005-chartsession-worker-host.md).

## Browser / Web Worker

- `@node-jhora/engine/browser` — `connectChartWorker()` (SharedWorker with dedicated Worker fallback) and Comlink RPC over `worker-api`.
- `@node-jhora/core/browser` — ephemeris bootstrap via `fetch` with IndexedDB / Cache API offline cache (`ensureEphemerisBytes`).
- Bundle budget: `pnpm run check:browser-bundle` (core browser entry &lt; 150 KiB gzip, excluding `de440s.bsp`).
- Playwright parity harness: `apps/browser-harness` (`pnpm test:browser`).
