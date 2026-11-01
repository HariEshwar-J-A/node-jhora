# Changelog

All notable changes to this project are documented in this file ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)).

## [Unreleased]

### Added

- Documentation tree under `docs/` (getting-started, guides, reference, performance, accuracy, architecture).
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, expanded `THIRD_PARTY_NOTICES.md`.
- Source copyright header check (`pnpm run check:copyright`) and `tools/normalize-format-api-report.mjs` for stable `@node-jhora/format` API reports.

### Changed

- ADR index complete for **0001–0033**; stale WASM/Swiss-Ephemeris-runtime claims removed from user-facing guides.
- Package `license` fields aligned to `SEE LICENSE IN LICENSE` (commercial use requires owner license).

### Server-grade (merged on main before this docs pass)

- PR4 #336 — astro-series cache, deep-era ΔTDB prefill (ADR 0030).
- PR5 #339 — edge kernel + workerd gate (ADR 0032).
- PR6 #338 — Decimal config / subpath bundles (ADR 0031).
- PR7 — server contract + worker bench (ADR 0033).
- Format CSV DST fold resolution (#340).

## 3.1.0

### Breaking

**D2 Hora now follows BPHS.** A Hora position can only be **Leo** (the Sun's
sign) or **Cancer** (the Moon's), per BPHS chapter 6 sloka 5-6: _"The first half
of an odd sign is the Hora ruled by the Sun while the second half is the Hora of
the Moon. The reverse is true in the case of an even sign."_

The previous implementation spread D2 across all twelve signs. Its own source
comment named the origin — `PyJHora uses __parivritti_even_reverse(dcf=2)` — so
it had been ported from another program rather than from the text.

```ts
calculateVarga(lon, 2); // BPHS: Leo or Cancer
calculateVarga(lon, 2, { horaScheme: 'parivritti' }); // previous behaviour
```

### Added

- **BPHS varga audit** — all sixteen divisional charts checked against
  Santhanam's translation, with sloka citations. Fourteen matched; D2 and D10
  did not. See [docs/guides/bphs-varga-audit.md](docs/guides/bphs-varga-audit.md).
- `horaScheme` configuration option, settable as a library default, an instance
  default, a per-call override, or a REST field.

### Fixed

- `@node-jhora/reporting` shipped with **no `license` field**, publishing as
  unlicensed.
- All packages now declare `LicenseRef-NodeJHora-Source-Available` instead of
  `SEE LICENSE IN LICENSE`, which npm renders as _unlicensed_.
- `repository.url` normalised (`npm pkg fix`), silencing a warning on every
  publish.
- The monorepo root is now `private: true`. `npm publish` at the root packed the
  entire workspace — including the `data/` birth records and the 32 MB ephemeris
  binary — and failed only because the root name was unregistered.

---

## 3.0.0

### Breaking

Defaults now target **True Chitrapaksha + BPHS rules**, so existing charts will
shift on upgrade. `JHORA_PRESET` restores Jagannatha Hora's conventions in one
line.

| Setting         | Default                                 |
| --------------- | --------------------------------------- |
| `ayanamsaMode`  | `27` True Chitrapaksha (Drik Siddhanta) |
| `positionMode`  | `'geometric'`                           |
| `nodeType`      | `'true'`                                |
| `dasamsaScheme` | `'parashara'`                           |

### Fixed — astrometry

Five defects, each independently measurable:

- **`evalChebyDeriv` returned ~0.355× the true derivative.** Earth's barycentric
  speed came out 10.7 km/s instead of 30.2, corrupting stellar aberration and
  every retrograde determination.
- **Light-time was computed in days and subtracted from an epoch in seconds**,
  making the correction ~86400× too small — effectively absent.
- **Annual aberration and solar light deflection were never applied.**
- **ΔT was ignored entirely** (UT treated as TDB) — ~35″ of lunar motion.
- **Precession was applied as a scalar addition** of ψ_A to an ecliptic
  longitude. It is a frame rotation, not a translation.

Tropical longitudes are now within **0.28″ of JPL Horizons** across 1900–2024,
from 7–41″ before.

- `nodeType` was accepted and silently ignored; the true node is now implemented
  from the osculating orbit.
- The ascendant was 180° out for roughly half the zodiac.

### Added

- New engine modules: `deltat.ts`, `precession.ts` (IAU 2006), `nutation.ts`
  (IAU 1980), `apparent.ts`.
- Full configuration surface — every option settable at three levels. See
  [CONFIGURATION.md](CONFIGURATION.md).
- `.jhd` reader for Jagannatha Hora chart files.
- `tools/verify-jhd.mjs` and `tools/benchmark-vs-jhora.mjs`.

### Changed — test fixtures

Rebuilt with separated provenance: JPL Horizons for astrometry, a real JHora
export for conventions, and a regression snapshot that is explicitly _not_
evidence. The previous fixtures were captured from the broken engine and
asserted a retrograde Sun and Moon.

Removed the PyJHora fixture: it does not describe any real chart. Its ascendant
is exactly 179.999° off, and no single instant reproduces its planet set.

**554 tests, 37 suites, 0 skipped.**
