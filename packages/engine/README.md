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
    instant: DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' }),
    location: { latitude: 13.0827, longitude: 80.2707 },
    settings: 'node-jhora-default',
    ephemeris: eph,
});

const planets = session.getPlanets();
const slice = session.collect(['houses', 'panchanga']);
```

Worker packaging is described in [docs/decisions/0005-chartsession-worker-host.md](../../docs/decisions/0005-chartsession-worker-host.md).
