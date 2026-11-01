# Node.js quickstart

```bash
corepack enable && corepack prepare --activate
pnpm install --frozen-lockfile
pnpm build
```

```js
import { EphemerisEngine } from '@node-jhora/core';

const eph = EphemerisEngine.getInstance();
await eph.initialize();

const planets = eph.getPlanets(
    '2000-01-01T12:00:00+05:30',
    { latitude: 13.0827, longitude: 80.2707 },
    { zodiac: 'sidereal', ayanamsaOrder: 27 },
);
console.log(planets.find((p) => p.name === 'Sun')?.longitude);
```

Defaults match **True Chitrapaksha** (SE mode 27), geometric positions, true node — see [guides/core.md](../guides/core.md).

Commercial use requires a license; see the repository root `LICENSE` file.
