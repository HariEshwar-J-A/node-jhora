# @node-jhora/prediction

Time-based predictive logic for the Node-Jhora Vedic astrology engine. Provides multiple Dasha systems (Vimshottari, Yogini, Narayana), transit scanning with Newton-Raphson precision, and Jaimini predictive tools (Chara Karakas, Arudha Padas, Chara Dasha).

> Part of the [node-jhora](../../README.md) monorepo. [📖 Full Documentation](../../docs/PREDICTION.md)

## Installation

```bash
npm install @node-jhora/prediction @node-jhora/core @node-jhora/analytics
```

## Quick Start

```typescript
import { generateVimshottari, YoginiDasha, TransitEngine, JaiminiCore, JaiminiDashas } from '@node-jhora/prediction';

// Vimshottari — 120-year cycle, 5 recursive levels
const dashas = generateVimshottari(birthDate, moonLongitude, 5);

// Yogini — 8-year recurring cycles
const yogini = YoginiDasha.calculate(moonLongitude, birthDate, 80);

// Jaimini Karakas
const karakas = JaiminiCore.calculateKarakas(planets);

// Transit scanning
const engine = new TransitEngine();
const events = await engine.findTransits(0, startDate, endDate);
```

## Features

| Feature | Description |
| :--- | :--- |
| **Vimshottari Dasha** | 120-year cycle, 5 levels (Maha → Antar → Pratyantar → Sookshma → Prana) |
| **Dasha Balance** | Birth Nakshatra balance calculation |
| **Yogini Dasha** | 8-year recurring cycle with 8 Yogini lords |
| **Narayana Dasha** | Rashi-based with odd/even directional logic |
| **Transit Engine** | Newton-Raphson aspect timing (1e-7° tolerance) |
| **Jaimini Karakas** | 7-karaka system (AK, AmK, BK, MK, PK, GK, DK) |
| **Arudha Padas** | Reflected house points with exception rules |
| **Chara Dasha** | Jaimini sign-based timing sequences |

## Exports

```typescript
export { generateVimshottari, calculateDashaBalance, TransitEngine,
         YoginiDasha, NarayanaDasha, JaiminiCore, JaiminiDashas };
export type { DashaPeriod, TransitEvent, JaiminiKaraka, ArudhaPada, CharaDashaPeriod };
```

## License

**© Copyright HariEshwar-J-A (Harieshwar Jagan Abirami).** All rights reserved.

This software is proprietary. For commercial use, enterprise integration, or any other use cases, explicit permission is required. Usage is subject to agreed-upon payment and licensing terms. Please contact the author for licensing inquiries.
