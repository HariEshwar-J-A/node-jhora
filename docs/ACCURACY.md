# Accuracy

Every number here is measured and reproducible. Nothing is asserted from
reputation.

## How accuracy is established

A sidereal longitude is `astrometry − ayanamsa`. Those two halves are
independently wrong-able, so they are validated **separately, against different
sources**:

| What | Reference | Fixture |
|---|---|---|
| Astrometry | **JPL Horizons** | `packages/core/tests/fixtures/horizons_golden.ts` |
| JHora conventions | a real **JHora export** | `packages/core/tests/fixtures/jhora_golden.ts` |
| Regression only | this engine's own output | `packages/core/tests/fixtures/reference_charts.ts` |

Collapsing these is the failure mode this project has already lived through: an
earlier revision back-fitted ayanamsa constants until one chart reproduced one
expected Moon longitude. That hid 7–41″ of astrometric error at that date and
re-emitted it everywhere else, while the suite reported agreement it had never
established — and simultaneously asserted a retrograde Sun.

Each suite therefore also carries **fixture-independent physical assertions**:
the Sun is never retrograde, the ascendant leads the MC by 0°–180°, daily motion
stays within orbital bounds. Those are what catch a bad re-baseline.

## Astrometric accuracy vs JPL Horizons

Tropical apparent longitude, all bodies, spanning the DE440s range:

| Epoch | Worst error |
|---|---|
| 1900-01-01 | 0.28″ |
| 1970-07-08 | 0.05″ |
| 1998-12-06 | 0.20″ |
| 2024-06-15 | 0.23″ |
| 2100-01-01 | 46″ — ΔT forecast gap only |

For scale: 1″ is three orders of magnitude below any varga or nakshatra-pada
boundary. It cannot change a chart reading.

## Parity with JHora

Against a real JHora natal export (1998-12-06 09:23 IST, Chennai), using
`JHORA_PRESET`:

| Quantity | Delta |
|---|---|
| Ayanamsa (True Chitrapaksha) | 0.015″ |
| Sun, Mercury, Venus, Mars, Saturn | 0.01″ |
| Moon, Jupiter, **Ascendant** | 0.00″ |
| Rahu / Ketu | 0.12″ |
| D9 Navamsa, all bodies | 0.1″ |
| D10 Dasamsa (`jhora_5_8`) | 0.5″ |
| Local sidereal time | 0.24 s |
| Panchanga (tithi, nakshatra, yoga, karana, vara) | exact |
| Vimshottari dasha | ~1 day over the full 120-year cycle |

Reproducing JHora requires four **conventions**, not just correct astronomy —
each confirmed by that export:

| Convention | Setting | Evidence |
|---|---|---|
| True Chitrapaksha | `ayanamsaMode: 27` | JHora prints `23-49-35.07`; engine 0.015″ away |
| Geometric places | `positionMode: 'geometric'` | removing light-time + aberration moves Venus 43.9″, Sun 20.8″, Saturn 7.4″ — each onto JHora to 0.01″ |
| True node | `nodeType: 'true'` | mean node misses Rahu by 0.97°; osculating node by 0.12″ |
| JHora Dasamsa | `dasamsaScheme: 'jhora_5_8'` | odd signs agree either way; all five even-sign bodies agree only under this rule |

## Is node-jhora more accurate than JHora?

Comparing two programs to each other cannot answer that. It needs an independent
referee, so both are scored against **JPL Horizons**, on **angular separations
between bodies** — in which the ayanamsa (a choice, not an error) and nutation
cancel exactly, leaving pure astrometry.

Source data is JHora's own legacy `.jhd` files, which embed the longitudes JHora
computed.

| Chart | Year | node-jhora | JHora | Factor |
|---|---|---|---|---|
| Prof. B. Suryanarain Rao | 1856 | 0.68″ rms | 2.22″ | 3× |
| Swami Vivekananda | 1863 | 0.33″ rms | 1.82″ | 5× |
| Prof. B. V. Raman | 1912 | 0.14″ rms | 10.38″ | 74× |
| Swami Jayendra Saraswati | 1935 | 0.08″ rms | 8.53″ | 113× |

node-jhora is closer on **4/4**. Worst single separation error: node-jhora
**1.63″**, JHora **25.15″**. JHora's error concentrates in the **Moon**, where
lunar theory is hardest.

> **Read this claim carefully.** Those `.jhd` files were written by JHora circa
> 1999–2003 and embed an older ephemeris. Against a *current* JHora export the
> two agree to 0.01″. The defensible statement is "more accurate than the JHora
> builds that wrote these files", not "more accurate than JHora today".

```bash
node tools/benchmark-vs-jhora.mjs
```

## PyJHora

**Not benchmarked, and the claim previously recorded in this repo is unverified.**

The only PyJHora data here is `pyjhora_golden.ts`, and it does not describe any
real chart:

- its ascendant is exactly **179.999°** from the correct value — the signature of
  a since-fixed node-jhora ascendant bug, so the number was produced by the
  broken engine rather than read from PyJHora;
- **no single instant reproduces its planet set**. Solving each body for the date
  it implies: Sun +0.15 d, Moon −179.7 d, Mercury −26 d, Venus +42 d; Mars,
  Jupiter and Saturn cannot be fitted within ±200 days.

Nothing can be concluded from it. Benchmarking PyJHora requires running PyJHora
and capturing its output.

## Reproducing everything

```bash
npm run build
NODE_OPTIONS="--experimental-vm-modules" npx jest   # 547 tests, 37 suites
node tools/verify-jhd.mjs data/
node tools/benchmark-vs-jhora.mjs
```
