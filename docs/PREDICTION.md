# Package: `@node-jhora/prediction`

The `@node-jhora/prediction` package handles time-based calculations, including dasha sequences, transit scanners, and Jaimini predictive tools.

---

## ⏳ Dasha Systems

Supports multiple Vedic predictive time-cycle systems.

### 1. Vimshottari Dasha

The most widely used system based on 120-year cycles tied to the Moon's Nakshatra position.

- **Precision**: Calculates down to 5 recursive levels (Maha → Antar → Pratyantar → Sookshma → Prana).
- **Balance**: `calculateDashaBalance()` computes the remaining balance of the birth Nakshatra's lord at time of birth.

```typescript
import { generateVimshottari, calculateDashaBalance } from '@node-jhora/prediction';
import type { DashaPeriod } from '@node-jhora/prediction';

// Generate full dasha tree
// Parameters: birthDate, moonLongitude, recursionDepth (1-5)
const dashas: DashaPeriod[] = generateVimshottari(birthDate, moonLon, 5);

dashas.forEach(maha => {
    console.log(`${maha.planet}: ${maha.start.toISODate()} → ${maha.end.toISODate()}`);
    maha.subPeriods?.forEach(antar => {
        console.log(`  └─ ${antar.planet}: ${antar.start.toISODate()} → ${antar.end.toISODate()}`);
    });
});

// Calculate remaining balance at birth
const balance = calculateDashaBalance(moonLon);
```

**`DashaPeriod` Structure:**

```typescript
interface DashaPeriod {
    planet: string;     // Dasha lord name
    start: DateTime;    // Period start
    end: DateTime;      // Period end
    years: number;      // Duration in years
    subPeriods?: DashaPeriod[]; // Nested sub-periods (recursive)
}
```

### 2. Yogini Dasha

An 8-year recurring cycle system with 8 Yogini lords:

```typescript
import { YoginiDasha } from '@node-jhora/prediction';

// Parameters: moonLongitude, birthDate, totalYears
const periods = YoginiDasha.calculate(moonLon, birthDate, 80);
```

**Yogini Lords & Durations:**

| Yogini | Planet | Years |
| :--- | :--- | :---: |
| Mangala | Moon | 1 |
| Pingala | Sun | 2 |
| Dhanya | Jupiter | 3 |
| Bhramari | Mars | 4 |
| Bhadrika | Mercury | 5 |
| Ulka | Saturn | 6 |
| Siddha | Venus | 7 |
| Sankata | Rahu | 8 |

### 3. Narayana Dasha

A **Rashi-based** dasha (Varga Dasha) used for general life events, following Jaimini principles.

- **Directional Logic**: Odd signs count forward, even signs count in reverse.
- **Exceptions**: Saturn and Ketu exceptions when placed in the Lagna sign.

```typescript
import { NarayanaDasha } from '@node-jhora/prediction';

const periods = NarayanaDasha.calculate(lagnaSign, planets, birthDate);
```

---

## 🛰️ Transit Engine

Scans for planetary movement over time, detecting house ingresses and aspects using **Newton-Raphson** iterative refinement.

```typescript
import { TransitEngine } from '@node-jhora/prediction';
import type { TransitEvent } from '@node-jhora/prediction';

const engine = new TransitEngine();

// Find all transits for Sun within a date range
const events: TransitEvent[] = await engine.findTransits(
    0,         // Planet ID (Sun)
    startDate, // DateTime
    endDate    // DateTime
);

events.forEach(ev => {
    console.log(`${ev.type} at ${ev.date.toISO()}: ${ev.description}`);
});
```

### Exact Aspect Detection

Uses Newton-Raphson method with the first derivative (planetary speed) to find the precise moment of an aspect:

```typescript
// Find exact Sun-Mars conjunction
const exactDate = await engine.findExactAspect(
    0,         // Planet A (Sun)
    4,         // Planet B (Mars)
    0,         // Target angle (0° = conjunction, 180° = opposition)
    startDate  // Search start
);
```

The transit engine refines iteratively until the angular distance reaches a tolerance of `1e-7` degrees.

---

## 💎 Jaimini System

Core Jaimini astrological components, implemented as two modules.

### JaiminiCore — Karakas & Arudhas

```typescript
import { JaiminiCore } from '@node-jhora/prediction';
import type { JaiminiKaraka, ArudhaPada } from '@node-jhora/prediction';
```

#### Chara Karakas (7-Karaka System)

Calculates karakas based on planetary degrees within their rashi (highest degree = Atmakaraka):

| Karaka | Abbreviation | Rule |
| :--- | :--- | :--- |
| Atmakaraka | AK | Highest degree in sign |
| Amatyakaraka | AmK | Second highest |
| Bhratrukaraka | BK | Third highest |
| Matrukaraka | MK | Fourth highest |
| Putrakaraka | PK | Fifth highest |
| Gnatikaraka | GK | Sixth highest |
| Darakaraka | DK | Lowest (seventh) |

```typescript
const karakas: JaiminiKaraka[] = JaiminiCore.calculateKarakas(planets);
karakas.forEach(k => {
    console.log(`${k.karaka}: Planet ${k.planetId} at ${k.degree.toFixed(2)}°`);
});
```

#### Arudha Padas

Calculates the **reflected points** for all 12 houses:

```typescript
const arudhas: ArudhaPada[] = JaiminiCore.calculateArudhaPadas(lagnaSign, planets, houses);
```

**Exception Rules:**
- If a house lord is placed in the same house → Arudha jumps 10 signs forward.
- If a house lord is in the 7th from the house → Arudha jumps 4 signs forward.

### JaiminiDashas — Chara Dasha

Sign-based timing sequences following Jaimini's directional logic:

```typescript
import { JaiminiDashas } from '@node-jhora/prediction';
import type { CharaDashaPeriod } from '@node-jhora/prediction';

const charaDasha: CharaDashaPeriod[] = JaiminiDashas.calculateCharaDasha(lagnaSign, planets);
charaDasha.forEach(period => {
    console.log(`Sign ${period.sign}: ${period.years} years`);
});
```

---

## 📋 Full Export Reference

```typescript
// Functions
export { generateVimshottari, calculateDashaBalance, TransitEngine, YoginiDasha, NarayanaDasha, JaiminiCore, JaiminiDashas };

// Types
export type { DashaPeriod, TransitEvent, JaiminiKaraka, ArudhaPada, CharaDashaPeriod };
```
