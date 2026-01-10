# Package: `@node-jhora/prediction`

The `@node-jhora/prediction` package handles time-based calculations, including dasha sequences, transit scanners, and Jaimini predictive tools.

## ⏳ Dasha Systems

Supports multiple predictive time-cycle systems.

### 1. Vimshottari Dasha
The most widely used system based on 120-year cycles.
- **Precision**: Calculates down to 5 levels (Maha, Antar, Pratyantar, Sookshma, Prana).
- **Flexibility**: Handles any duration and provides nested structure.

```typescript
import { generateVimshottari } from '@node-jhora/prediction';

const dashas = generateVimshottari(birthDate, moonLon, 120);
```

### 2. Yogini Dasha
An 8-year recurring cycle system.
```typescript
import { YoginiDasha } from '@node-jhora/prediction';
const periods = YoginiDasha.calculate(moonLon, birthDate, 80);
```

### 3. Narayana Dasha
A Rashi-based dasha (Varga Dasha) used for general life events.
- **Directional Logic**: Odd/Even sign logic for forward/reverse sequences.
- **Exceptions**: Handles Saturn and Ketu exceptions in the Lagna.

---

## 🛰️ Transit Engine

Scans for planetary movement over time, detecting house ingresses and aspects.

```typescript
import { TransitEngine } from '@node-jhora/prediction';

const engine = new TransitEngine();
const events = await engine.findTransits(
    0, // Sun
    startDate,
    endDate
);

// Aspect detection using Newton-Raphson for high precision
const conjunct = await engine.findExactAspect(0, 4, 0 /* conjunction */, startDate); 
```

---

## 💎 Jaimini System

Core Jaimini astrological components.

### 1. Chara Karakas
Calculates the 7-karaka system based on planetary degrees within a rashi.
- `AK` (Atmakaraka): Highest degree.
- `AmK` (Amatyakaraka): Second highest.
- ... and so on.

### 2. Arudha Padas
Calculates the "Reflected Points" for houses.
- Handles the **exception rules** where if the lord is in the same house or 7th house, the Arudha jumps another 10/4 signs.

### 3. Chara Dasha
Sequence based on Jaimini's sign-based logic.
```typescript
import { JaiminiDashas } from '@node-jhora/prediction';
const chara = JaiminiDashas.calculateCharaDasha(lagnaSign, planets);
```
