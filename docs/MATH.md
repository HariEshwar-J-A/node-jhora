# Mathematical Foundation

Node-Jhora is built on **first-principles math** to ensure astronomical and astrological precision. The engine employs high-precision arbitrary-decimal arithmetic, spherical geometry, time-series interpolation, and iterative numerical methods.

---

## 🎯 Precision Math (Decimal.js)

Native JavaScript `Number` (IEEE 754 double-precision) introduces floating-point drift that accumulates across chained Varga, Dasha, and Nakshatra computations. Node-Jhora uses **`Decimal.js`** for all critical calculations.

### The Problem

```typescript
// Native JS floating-point drift:
0.1 + 0.2               // 0.30000000000000004
(360 / 27) * 27          // 360.00000000000006
```

### The Solution

```typescript
import { D, toNum, normalize360D, NAKSHATRA_SPAN_D, DASHA_YEAR_DAYS } from '@node-jhora/core';

const lon = D('123.456789012345');      // Full-precision Decimal
const norm = normalize360D(lon);         // Normalize [0, 360) with no drift
const num = toNum(norm);                 // Convert to JS number for output

// Pre-computed constants:
NAKSHATRA_SPAN_D  // Decimal(360/27) = 13.333... (exact)
DASHA_YEAR_DAYS   // Decimal(365.25) — Julian year
```

### Where Precision Matters

| Module | Why Decimal.js is Essential |
| :--- | :--- |
| Varga Calculations | D9, D60 require dividing 30° into tiny sub-arcs (0.5° for D60) |
| Nakshatra Padas | Each Pada is 3°20′ — rounding errors cascade across 108 Padas |
| Dasha Balance | Birth Nakshatra balance depends on exact Moon position within 13.33° span |
| Arudha Padas | Sign-counting arithmetic must be exact to avoid off-by-one errors |

---

## 📐 Angular Normalization

In JS/TS, the standard `%` operator (remainder) behaves inconsistently with negative numbers:

```typescript
-10 % 360   // Returns -10 (WRONG for astronomy)
370 % 360   // Returns 10 (OK)
```

Node-Jhora provides two normalization functions:

### Standard (Number)

```typescript
export function normalize360(angle: number): number {
    let res = angle % 360;
    if (res < 0) res += 360;
    if (res >= 360) return 0;
    return res;
}

normalize360(370);   // 10
normalize360(-10);   // 350
normalize360(720);   // 0
```

### Precision (Decimal.js)

```typescript
import { normalize360D, D } from '@node-jhora/core';

normalize360D(D(-10));    // Decimal(350) — no floating-point drift
normalize360D(D(370.5));  // Decimal(10.5)
```

### Shortest Arc Distance

For interpolation and transit detection, the engine computes the shortest arc between two angles, handling the 360°→0° wrap-around:

```typescript
import { getShortestDistance } from '@node-jhora/core';

getShortestDistance(350, 10);  // 20  (not 340)
getShortestDistance(10, 350);  // -20 (shortest path backward)
```

---

## 🌐 Spherical Correction (Topocentric Parallax)

While most astrology software uses **Geocentric** (Earth's center) positions, real-world observations use **Topocentric** (observer's surface) positions. This is critical for the **Moon**, which can shift by up to **1°** depending on the observer's latitude and the Moon's altitude.

### How It Works

The parallax correction transforms geocentric ecliptic coordinates to topocentric using:

1. **Local Sidereal Time (LST)**: Calculated from Julian Day and observer longitude.
2. **Ecliptic Obliquity (ε)**: The tilt of Earth's axis (~23.44°), obtained from Swiss Ephemeris.
3. **Planetary Distance**: In AU, from Swiss Ephemeris — used to compute the parallax angle.

### When to Enable

```typescript
// Enable topocentric correction for Moon-sensitive calculations:
const planets = engine.getPlanets(date, location, {
    topocentric: true  // Corrects Moon by up to 1°
});
```

**Impact by planet:**

| Planet | Max Parallax Shift | Significance |
| :--- | :---: | :--- |
| Moon | ~1° | **Critical** — affects Nakshatra, Tithi, Dasha balance |
| Sun | ~0.002° | Negligible |
| Mars | ~0.005° | Negligible |
| Others | < 0.001° | Negligible |

---

## ⏳ Time Interpolation (Ephemeris Interpolator)

For high-frequency UI updates (60fps), recalculating planetary positions via WASM every frame is prohibitively expensive (~5ms per call).

### Linear Interpolation (Lerp)

The `EphemerisInterpolator` pre-computes positions at two boundary points and linearly interpolates between them:

```
Position(t) = P₀ + (P₁ - P₀) × progress
```

Where `progress = (t - t₀) / (t₁ - t₀)`.

### 360° Wrap-Around Handling

The interpolator uses `getShortestDistance()` to handle the critical 360°→0° boundary:

```
// WRONG: Lerp(359°, 1°) ≠ 180° (should be 0° ± 1°)
// RIGHT: ShortestArc(359°, 1°) = +2°, then Lerp normally
```

This enables smooth 60fps planet animations without visible jumps at sign boundaries.

---

## 🎯 Newton-Raphson Refinement

When scanning for transits or aspects (e.g., *"Exactly when does Mars conjunct Saturn?"*), the engine uses the **Newton-Raphson** method for high-precision time-finding.

### Algorithm

```
t_{n+1} = t_n - f(t_n) / f'(t_n)
```

Where:
- `f(t)` = angular distance between two planets at time `t`
- `f'(t)` = rate of change of angular distance (relative speed)

### Properties

| Property | Value |
| :--- | :--- |
| Convergence | Quadratic (doubles precision each iteration) |
| Tolerance | `1e-7` degrees |
| Typical iterations | 4–6 |
| Applications | Exact conjunctions, oppositions, trine timings |

### Compared to Binary Search

The `TransitScanner` in `@node-jhora/events` uses binary search (bisection) for event detection, while the `TransitEngine` in `@node-jhora/prediction` uses Newton-Raphson. The approaches serve different needs:

| Method | Where Used | Best For |
| :--- | :--- | :--- |
| **Binary Search** | `@node-jhora/events` | Generic condition flips (ingress, station) |
| **Newton-Raphson** | `@node-jhora/prediction` | Exact angular aspect timing |

---

## 🔄 DMS Conversion Utilities

Convert between decimal degrees and Degrees/Minutes/Seconds:

```typescript
import { dmsToDecimal, decimalToDms } from '@node-jhora/core';

dmsToDecimal(13, 4, 58);  // 13.08277...
decimalToDms(13.08277);    // { degrees: 13, minutes: 4, seconds: 58, ... }
```
