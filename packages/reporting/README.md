# @node-jhora/reporting

Professional PDF birth chart report generation for the Node-Jhora Vedic astrology engine. Produces comprehensive reports with planetary positions, house cusps, Shadbala strengths, Yoga analysis, and chart diagrams.

> Part of the [node-jhora](../../README.md) monorepo. [📖 Full Documentation](../../docs/REPORTING.md)

## Installation

```bash
npm install @node-jhora/reporting @node-jhora/core @node-jhora/analytics
```

## Quick Start

```typescript
import { generateFullReport } from '@node-jhora/reporting';

const pdfBuffer = await generateFullReport(chartData, {
    subjectName: 'Ravi Shankar',
    birthDate: '1990-05-15',
    birthPlace: 'Chennai, Tamil Nadu',
    chartStyle: 'North'
});

// Save to file
import { writeFileSync } from 'fs';
writeFileSync('birth_chart.pdf', pdfBuffer);
```

## Features

| Feature | Description |
| :--- | :--- |
| **Full Report** | Planetary positions, houses, Yogas, and Shadbala in one PDF |
| **Chart Diagrams** | North Indian (diamond) and South Indian (grid) styles |
| **Yoga Analysis** | Automatic detection using built-in YOGA_LIBRARY |
| **Shadbala Table** | 6-fold strength breakdown per planet |
| **Buffer Output** | Returns `Buffer` for file saving or HTTP streaming |

## Exports

```typescript
export { generateFullReport, ChartDrawer };
export type { ReportOptions };
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
