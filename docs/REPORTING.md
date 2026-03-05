# Package: `@node-jhora/reporting`

The `@node-jhora/reporting` package generates professional **PDF birth chart reports** using [PDFKit](https://pdfkit.org/). It combines planetary positions, house data, Shadbala strengths, and Yoga detection into a comprehensive, printable document.

---

## 🏗️ Architecture

The package depends on:
- `@node-jhora/core` — Planetary positions and house data.
- `@node-jhora/analytics` — Shadbala calculation, Yoga detection, and YOGA_LIBRARY.
- `pdfkit` — PDF document generation.

---

## 📄 Report Generation

### `generateFullReport()`

Generates a complete Vedic astrology PDF report and returns it as a `Buffer`.

```typescript
import { generateFullReport } from '@node-jhora/reporting';
import type { ChartData } from '@node-jhora/core';

const chartData: ChartData = {
    planets,    // PlanetPosition[]
    houses,     // HouseData
    ascendant,  // number (degrees)
    ayanamsa    // string ('Lahiri', 'Raman', etc.)
};

const pdfBuffer: Buffer = await generateFullReport(chartData, {
    subjectName: 'Ravi Shankar',
    birthDate: '1990-05-15',
    birthPlace: 'Chennai, Tamil Nadu',
    chartStyle: 'North'  // or 'South'
});

// Save to file
import { writeFileSync } from 'fs';
writeFileSync('birth_chart.pdf', pdfBuffer);

// Or send as HTTP response
res.setHeader('Content-Type', 'application/pdf');
res.send(pdfBuffer);
```

### Configuration (`ReportOptions`)

```typescript
interface ReportOptions {
    subjectName?: string;        // Name displayed on the report
    birthDate?: string;          // Birth date string for the header
    birthPlace?: string;         // Birth place for the header
    chartStyle?: 'North' | 'South'; // Chart diagram style
}
```

---

## 📑 Report Sections

The generated PDF includes the following sections:

### 1. Header
- Subject name, birth date, and birth place.

### 2. Planetary Positions Table
- All 9 planets (Sun through Ketu) with:
  - Sidereal longitude
  - Sign and degree within sign
  - Speed (deg/day)
  - Retrograde indicator

### 3. House Cusps
- Ascendant, MC, and all 12 house cusp longitudes.
- House system used (Whole Sign, Placidus, etc.)

### 4. Chart Diagram
- Visual representation of the birth chart.
- Supports both North Indian (diamond) and South Indian (grid) styles.
- Rendered using the `ChartDrawer` module.

### 5. Yoga Analysis
- Detected Yogas from the built-in `YOGA_LIBRARY`.
- Category, name, and brief description for each.

### 6. Shadbala Strengths
- 6-fold strength breakdown for each planet.
- Total Virupas and Ishta Phala values.

---

## 🎨 Chart Drawing

The `ChartDrawer` module handles the visual chart rendering within the PDF:

```typescript
import { ChartDrawer } from '@node-jhora/reporting';

// Used internally by generateFullReport()
// Can also be used independently for custom PDF layouts
```

The drawer converts planetary positions into a visual chart layout, placing planet symbols in their correct houses based on the ascendant and house system.

---

## 📋 Full Export Reference

```typescript
// Functions
export { generateFullReport };

// Classes
export { ChartDrawer };

// Types
export type { ReportOptions };
```
