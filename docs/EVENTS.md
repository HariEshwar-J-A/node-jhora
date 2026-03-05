# Package: `@node-jhora/events`

The `@node-jhora/events` package provides precision astronomical event detection using **binary search (bisection)** algorithms. It finds the exact moments when specific celestial conditions change — sign ingresses, retrograde stations, and arbitrary custom conditions.

---

## 🏗️ Architecture

The package centers on the `TransitScanner` class, which wraps the `EphemerisEngine` and provides specialized event-finding methods.

```typescript
import { TransitScanner } from '@node-jhora/events';

const scanner = new TransitScanner();       // Uses EphemerisEngine singleton
// or
const scanner = new TransitScanner(engine); // Pass a specific engine instance
```

---

## 🔍 Generic Event Solver

The core algorithm: a **recursive binary search** that finds the exact moment a boolean condition flips from `false` to `true` within a time window.

```typescript
const eventTime = await scanner.findEventTime(
    startDate,   // DateTime — window start
    endDate,     // DateTime — window end
    checkFn,     // (date: DateTime) => boolean — condition function
    config       // Optional: { precisionSeconds, maxIterations }
);
```

### How It Works

1. Evaluate the condition at the start and end of the window.
2. If the condition is the same at both ends → no event (returns `null`).
3. Binary search: check the midpoint, narrow the window to the half where the flip occurs.
4. Repeat until the window is smaller than `precisionSeconds` (default: 60 seconds).

### Configuration

```typescript
interface TransitSearchConfig {
    precisionSeconds?: number; // Default: 60 (1 minute precision)
    maxIterations?: number;    // Safety limit for recursion
}
```

### Example: Custom Event

```typescript
// Find when the Moon enters the same sign as natal Sun
const event = await scanner.findEventTime(
    startDate,
    endDate,
    (date) => {
        const moon = scanner.getPlanetPos(1, date);
        const moonSign = Math.floor(moon.longitude / 30);
        return moonSign === natalSunSign;
    },
    { precisionSeconds: 10 } // 10-second precision
);
```

---

## 🌅 Sign Ingress Detection

### `findIngress()` — Specific Sign

Finds when a planet enters a specific zodiac sign:

```typescript
const ingressTime = await scanner.findIngress(
    5,           // Planet ID (Jupiter)
    0,           // Target sign index (0 = Aries, 11 = Pisces)
    searchStart, // DateTime
    searchEnd    // Optional — defaults to +1 month
);

if (ingressTime) {
    console.log(`Jupiter enters Aries at ${ingressTime.toISO()}`);
}
```

### `findNextIngress()` — Auto-Detect Next Sign

Automatically determines the next sign boundary based on the planet's current position and speed, then finds the exact ingress time:

```typescript
const nextIngress = await scanner.findNextIngress(
    5,         // Planet ID (Jupiter)
    startDate  // DateTime — search from this point
);
```

**How it works:**
1. Gets the planet's current position and speed.
2. Calculates which sign boundary is next (forward for direct, backward for retrograde).
3. Estimates the crossing time using linear interpolation.
4. Searches in a refined window around the estimate (±20% of estimated duration).

---

## 🔄 Stationary Point Detection

Finds the exact moment a planet's speed crosses zero — the **retrograde station** (direct → retrograde) or **direct station** (retrograde → direct).

```typescript
const stationTime = await scanner.findStationaryPoint(
    6,           // Planet ID (Saturn)
    startDate,   // DateTime
    searchEnd    // Optional — defaults to +6 months
);

if (stationTime) {
    const pos = scanner.getPlanetPos(6, stationTime);
    const type = pos.speed < 0 ? 'Retrograde' : 'Direct';
    console.log(`Saturn goes ${type} at ${stationTime.toISO()}`);
}
```

**Note:** The default search window is 6 months — stations for outer planets (Jupiter, Saturn) can be far apart.

---

## 🛠️ Helper Method

### `getPlanetPos()`

Internal helper to get a planet's position at any date (used by all scanner methods):

```typescript
// Available on the scanner instance for custom condition functions
const pos = scanner.getPlanetPos(planetId, date);
// Returns: PlanetPosition { id, name, longitude, latitude, distance, speed, declination }
```

**Note:** Uses geocentric coordinates at (0°, 0°) by default for consistency.

---

## 📋 Full Export Reference

```typescript
// Classes
export { TransitScanner };

// Types
export type { TransitSearchConfig };
```

---

## 💡 Usage Tips

| Scenario | Method | Typical Precision |
| :--- | :--- | :--- |
| "When does Mars enter Gemini?" | `findIngress(4, 2, ...)` | 1 minute |
| "When is Mercury's next retrograde?" | `findStationaryPoint(2, ...)` | 1 minute |
| "When does Moon cross my Ascendant?" | `findEventTime(start, end, fn)` | Custom |
| "Next full moon" | `findEventTime(start, end, fn)` | Custom |

### Custom Condition Examples

```typescript
// Full Moon: Sun-Moon opposition (distance ~180°)
const fullMoon = await scanner.findEventTime(start, end, (date) => {
    const sun = scanner.getPlanetPos(0, date);
    const moon = scanner.getPlanetPos(1, date);
    const dist = Math.abs(moon.longitude - sun.longitude);
    const normalized = dist > 180 ? 360 - dist : dist;
    return normalized > 179; // Within 1° of opposition
});

// Planetary war: Two planets within 1°
const war = await scanner.findEventTime(start, end, (date) => {
    const mars = scanner.getPlanetPos(4, date);
    const saturn = scanner.getPlanetPos(6, date);
    const dist = Math.abs(mars.longitude - saturn.longitude);
    return dist < 1 || dist > 359; // Within 1°
});
```
