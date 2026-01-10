# Mathematical Foundation

Node-Jhora is built on "First Principles" math to ensure astronomical precision. Astrological calculations involve spherical geometry, time-series interpolation, and specialized angular normalization.

## 📐 Angular Normalization

In JS/TS, the standard `%` operator (remainder) behaves inconsistently with negative numbers (e.g., `-10 % 360` returns `-10`).

Node-Jhora uses a custom `normalize360` function to ensure all planetary longitudes are strictly in the range `[0, 360)`:

```typescript
export function normalize360(angle: number): number {
    let res = angle % 360;
    if (res < 0) res += 360;
    if (res >= 360) return 0;
    return res;
}
```

## 🌐 Spherical Correction (Topocentric Parallax)

While most astrology software uses Geocentric (Earth's center) positions, real-world observatories use **Topocentric** (Observer's surface) positions. This is critical for the Moon, which can shift by up to 1° depending on the observer's location.

Node-Jhora implements the parallax correction formula using:
- **Sidereal Time (LST)**: Calculated from Julian Day and Longitude.
- **Ecliptic Obliquity**: The tilt of Earth's axis (ε).
- **Planetary Distance**: Obtained via Swiss Ephemeris.

## ⏳ Time Interpolation

For high-frequency UI updates (60fps), recalculating planetary positions via WASM every frame is expensive. 

The `EphemerisInterpolator` uses **Linear Interpolation (Lerp)** over a pre-calculated time-window, handling the 360° -> 0° wrap-around point using the shortest arc distance.

## 🎯 Newton-Raphson Refinement

When scanning for transits or aspects (e.g., "Exactly when does Mars conjunct Saturn?"), the engine uses the **Newton-Raphson** method. It iteratively refines the time estimate based on the planetary speeds (the first derivative of position) until the angular distance is zero within a tolerance of `1e-7`.
