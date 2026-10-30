# Rise, set, and meridian transits

`@node-jhora/core` exposes `findRiseSetEvent` and `computeRiseSetTable` in `src/astro/riseset.ts`.

Defaults match the `jhora-default@8.0` preset: disc centre, no refraction, geometric topocentric places.

```typescript
import {
    EphemerisEngine,
    findRiseSetEvent,
    riseSetDefinitionFromSettings,
    getPreset,
} from '@node-jhora/core';

const engine = EphemerisEngine.getInstance();
await engine.initialize();

const def = riseSetDefinitionFromSettings(getPreset('jhora-default@8.0'));
const sunrise = findRiseSetEvent(
    engine,
    0, // Sun
    'rise',
    jdUtStart,
    { latitude: 13.08, longitude: 80.27, altitude: 0 },
    def,
);
```

Polar day or night returns `{ kind: 'none', reason: 'polar_day' | 'polar_night' }`.

The search is Meeus's hour-angle formula (Astronomical Algorithms, ch. 15), polished by a local Brent root of the topocentric altitude. When that estimate has no root, the residual is scanned for 26 hours, the look-ahead both oracles use for a one-off crossing (ADR 0009). Culmination sets the apparent right ascension equal to local apparent sidereal time. The equatorial place is the true equinox of date after the IAU 2000 frame bias (IERS Conventions 2010, §5.4.5 and §5.9; dα₀ is eq. 5.21, ξ₀ and η₀ are eq. 5.33); chart longitudes stay on the ICRF. Refraction, when enabled, is Bennett's formula as rearranged by Saemundsson, and the sea-horizon dip is 1.76′ √h(m) (Nautical Almanac). With refraction off, dip is not applied.

Which disc each profile puts on the horizon was measured from oracle outputs and is recorded in [ADR 0009](../../../docs/decisions/0009-rise-set-horizon-and-high-latitude.md):

| Profile  | Rise and set                                                                                                    |
| :------- | :-------------------------------------------------------------------------------------------------------------- |
| `jhora`  | Geometric disc at every latitude                                                                                |
| `modern` | Apparent disc, except the Sun for \|φ\| > 65° and every other body for \|φ\| > 60°, where the disc is geometric |

Both profiles culminate the apparent place.

Golden oracles (JSON only; the clocks are not shipped). The committed files are a sample of those captures; provenance is in `tests/fixtures/riseset/README.md`.

| Fixture                                      | Profile  | What it pins                                                                        |
| :------------------------------------------- | :------- | :---------------------------------------------------------------------------------- |
| `tests/fixtures/riseset.jhora-dll.json`      | `jhora`  | JHora 8.0 DLL, tool 2.02.01, latitudes to 64.5°                                     |
| `tests/fixtures/riseset.pyswisseph-se1.json` | `modern` | pyswisseph 2.10.03, DE431-class ephemeris, same cases                               |
| `tests/fixtures/riseset.highlat-jhora.json`  | `jhora`  | Latitudes 55–90°, 1900–2100, including the poles. Slow-method times on the jhora ΔT |
| `tests/fixtures/riseset.highlat-modern.json` | `modern` | Same sample, default 2.10 call                                                      |

Each profile uses its own ΔT model. The modern profile is compared with pyswisseph as shipped (ADR 0007); no row injects the oracle's ΔT. The jhora high-latitude rows after 2026 are the slow-method geometry on the jhora ΔT, because that clock and the 2.10 clock have diverged. The horizon equator is the IAU 2000 frame bias of the ICRF place (ADR 0009). Every event is held to 1 s, including the March-equinox Sun at the geographic poles.

Error tables: `node tools/riseset-max-error.mjs` after `pnpm build`.
