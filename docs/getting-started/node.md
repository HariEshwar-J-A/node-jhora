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
    '2020-12-21T18:20:00+05:30',
    { latitude: 51.476852, longitude: -0.0005 },
    { zodiac: 'sidereal', ayanamsaOrder: 27 },
);
console.log(planets.find((p) => p.name === 'Sun')?.longitude);
```

Defaults match **True Chitrapaksha** (SE mode 27), geometric positions, true node — see [guides/core.md](../guides/core.md).

Commercial use requires a license; see the repository root `LICENSE` file.
