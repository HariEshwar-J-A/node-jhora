# Horizons accuracy oracle

Independent astrometry check for `@node-jhora/core` against the [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html). This tree is **test-only**; nothing here ships in npm packages.

## What it checks

- **Frame:** apparent, airless, geocentric or topocentric places referred to the **true equator and ecliptic of date** (Horizons `QUANTITIES=2,31`, `APPARENT=AIRLESS`).
- **Engine profile:** `precisionProfile: 'modern'` with `positionMode: 'apparent'` (and `topocentric: true` at ground sites).
- **Bodies:** Sun through Saturn (SPK bodies in DE440s today).

## Epochs and sites

| Site      | Horizons `CENTER`          | Epochs                                                          |
| --------- | -------------------------- | --------------------------------------------------------------- |
| Geocenter | `500@399`                  | 1890, 1900, 1970, 2000-01-01 12:00, 2024, 2050, 2100, 2149 (UT) |
| Varanasi  | `coord@399` + `SITE_COORD` | 1900, 2000-01-01 12:00, 2024                                    |
| Palomar   | `coord@399` + `SITE_COORD` | 1900, 2000-01-01 12:00, 2024                                    |

## Commands

```bash
pnpm horizons-oracle:compare              # offline (cached fixtures)
pnpm horizons-oracle:refresh --live       # refetch from Horizons
pnpm horizons-oracle:nightly              # refresh + compare (CI/local)
```

Live refetch requires `--live` or `HORIZONS_ORACLE_LIVE=1`. Cached fixtures live under `fixtures/*.horizons.tsv` with query URL, retrieval time, and ephemeris version in the header.

## Convention gaps

See [ADR 0010](../../docs/decisions/0010-horizons-oracle-frame-gaps.md). Residuals are reported honestly; nothing is fitted to Horizons.
