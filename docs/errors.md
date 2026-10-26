# Typed errors (`NodeJHoraError`)

Public calculation APIs throw {@link NodeJHoraError} instead of returning `NaN` or
silently coercing invalid input. Import from `@node-jhora/core`:

```ts
import { NodeJHoraError, NodeJHoraErrorCode, isNodeJHoraError } from '@node-jhora/core';
```

## Codes

| Code                    | When                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `INVALID_INPUT`         | Non-finite numbers, unknown enums, invalid calendar components, wrong types           |
| `OUT_OF_RANGE`          | Latitude outside ±90°, Julian Day outside 10000 BC–10000 AD UT, ΔT override too large |
| `EPHEMERIS_UNAVAILABLE` | Date needs DE431 chunks or the kernel file is missing                                 |
| `NOT_INITIALIZED`       | `EphemerisEngine.initialize()` has not been called                                    |

## Supported UT span

Ephemeris APIs accept astronomical years **−10000** (10000 BC) through **+10000**,
including `10000-12-31T23:59:59Z` UT. Times beyond that instant, or before
`-10000-01-01`, throw `OUT_OF_RANGE`. Both proleptic Julian and Gregorian civil
dates in this span are accepted when converted to UT.

Long-range positions require DE431 NJCE chunks (`setChunkStore` / Node
`registerNodeChunkStore`). Chunks must contain real DE431 Chebyshev records for
the TT instant; the loader throws `EPHEMERIS_UNAVAILABLE` instead of clamping or
extrapolating. After `build:chunks`, the high century files extend through
**10000-12-31 UT plus ΔT and margin** (see `NJCE_TT_JD_MAX_REQUIRED` in `@node-jhora/core`).

## Longitude

House and topocentric APIs **normalize** longitude to `[-180, 180)` when the input
is within **±360°** (e.g. `360°` and `-180°` are equivalent). Magnitudes above
360° throw `INVALID_INPUT`. Non-finite longitude throws `INVALID_INPUT`.

`EphemerisEngine.getPlanets` requires a Luxon `DateTime` in UTC; pass
`engine.julday()` a JS `Date` if you need that coercion.

## ΔT override

`deltaTOverrideSeconds` must be finite and within **±864 000 s** (~10 days).
