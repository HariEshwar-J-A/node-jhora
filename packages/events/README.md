# @node-jhora/events

Precision astronomical event detection for the Node-Jhora Vedic astrology engine. Finds exact moments of sign ingresses, retrograde/direct stations, and arbitrary custom conditions using binary search.

> Part of the [node-jhora](../../README.md) monorepo. [📖 Full Documentation](../../docs/EVENTS.md)

## Installation

```bash
npm install @node-jhora/events @node-jhora/core
```

## Quick Start

```typescript
import { TransitScanner } from '@node-jhora/events';

const scanner = new TransitScanner();

// Find when Jupiter enters Aries
const ingress = await scanner.findIngress(5, 0, startDate);

// Find next retrograde station for Saturn
const station = await scanner.findStationaryPoint(6, startDate);

// Generic: find any condition flip
const event = await scanner.findEventTime(start, end, (date) => {
    const moon = scanner.getPlanetPos(1, date);
    return Math.floor(moon.longitude / 30) === targetSign;
});
```

## Features

| Feature | Description |
| :--- | :--- |
| **Generic Solver** | Binary search for any boolean condition flip within a time window |
| **Sign Ingress** | `findIngress()` — planet enters specific sign |
| **Auto Next Ingress** | `findNextIngress()` — auto-detect next sign boundary |
| **Stationary Points** | `findStationaryPoint()` — retrograde/direct station detection |
| **Configurable Precision** | Default 60s, adjustable to sub-second |

## Exports

```typescript
export { TransitScanner };
export type { TransitSearchConfig };
```

## License

**© Copyright HariEshwar-J-A (Harieshwar Jagan Abirami).** All rights reserved.

This software is proprietary. For commercial use, enterprise integration, or any other use cases, explicit permission is required. Usage is subject to agreed-upon payment and licensing terms. Please contact the author for licensing inquiries.

## Configuration

Every calculation choice is explicit and overridable at three levels —
library default, instance default, per-call override. Nothing is hidden in a
constant.

```
library default  →  instance default  →  per-call override
   (weakest)                                 (strongest)
```

Key options: `ayanamsaMode` (default `27`, True Chitrapaksha), `positionMode`
(`'geometric'`), `nodeType` (`'true'`), `houseSystem` (`'WholeSign'`),
`dasamsaScheme` (`'parashara'`, per BPHS), `topocentric`, `ayanamsaOffset`,
`sunriseHour`.

```ts
import { NodeJHora, JHORA_PRESET } from '@node-jhora/core';

// Library defaults: Drik Siddhanta astronomy, True Chitrapaksha, BPHS rules
const chart = new NodeJHora(location);

// Or reproduce Jagannatha Hora exactly
const jhora = new NodeJHora(location, JHORA_PRESET);
```

Full reference: [CONFIGURATION.md](../../CONFIGURATION.md) ·
Measured accuracy: [docs/ACCURACY.md](../../docs/ACCURACY.md)

## Accuracy

Validated against **JPL Horizons** (≤ 0.28″, 1900–2024) and against a real
**JHora** export (D1 to 0.01″, ascendant 0.00″). Scored against Horizons as an
independent referee, node-jhora is closer than JHora's own stored values on
4 of 4 legacy charts.
