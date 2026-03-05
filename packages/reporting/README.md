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
