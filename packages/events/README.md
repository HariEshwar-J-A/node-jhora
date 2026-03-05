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

Source Available — Commercial License Required. See [LICENSE](../../LICENSE).
