# Configuration

Every calculation choice in node-jhora is explicit, documented, and overridable
at three levels. Nothing is hidden in a constant.

```
library default  →  instance default  →  per-call override
   (weakest)                                 (strongest)
```

---

## Why there is more than one "correct" answer

A Jyotish chart is not the output of one algorithm. It is a stack of three
independent decisions, and **the authority for each is different**:

| Layer | Decides | Authority | Configurable? |
|---|---|---|---|
| **1. Astronomy** | where the bodies physically are | JPL DE440 / Horizons | only `positionMode`, `topocentric` |
| **2. Sidereal zero point** | where 0° Aries sits | a *named choice* — genuinely undecidable | `ayanamsaMode`, `ayanamsaOffset` |
| **3. Jyotish rules** | vargas, houses, dashas | **BPHS** | `dasamsaScheme`, `houseSystem`, `nodeType`, … |

Layer 1 is not a matter of opinion — it is measured, and this engine sits within
**0.28″ of JPL Horizons** across 1900–2024.

Layer 2 genuinely is undecidable. BPHS assumes a sidereal zodiac but fixes no
number, and the classical anchors (Chitra at 180°, Revati at 359°50′) are
mutually inconsistent by arcminutes. So the ayanamsa is always a *named model*,
never a fitted constant.

Layer 3 is settled by the text. Where an implementation departs from BPHS, this
library follows BPHS by default and offers the variant explicitly. See
[Dasamsa](#dasamsascheme) for the one case where that matters today.

---

## The options

All fields are optional. Defaults come from `DEFAULT_CONFIG`.

### `ayanamsaMode`
**Default: `27` (True Chitrapaksha)** · type `number` (`AYANAMSA.*`)

The sidereal zero point. Star-defined models are *derived* from a computed star
position and so carry no fitted constant — prefer them.

| Code | Model | Basis |
|---|---|---|
| `27` | **True Chitrapaksha** — Spica at 180° | star-defined, exact |
| `29` | True Pushya — δ Cancri at 106° | star-defined, exact |
| `30` | True Revati — ζ Piscium at 359°50′ | star-defined, exact |
| `35` | True Mula — λ Scorpii at 240° | star-defined, exact |
| `0` | Fagan/Bradley | epoch anchor, published definition |
| `1` | Lahiri (ICRC) — 23°15′00″ at 1956-03-21 | epoch anchor, published definition |
| `3` | Raman — 21°00′00″ at 1900-01-01 | epoch anchor, published definition |
| `5` | Krishnamurti (KP) | epoch anchor, **provisional** |
| `7` | Yukteshwar | epoch anchor, **provisional** |
| `18` | J2000 (no ayanamsa) | — |

Entries marked *provisional* have not been verified against a primary source and
may be off by arcminutes. `AYANAMSA_MODELS[mode].source` records provenance.

### `ayanamsaOffset`
**Default: `0`** · degrees

A constant added to the ayanamsa, for practitioners who work with a personal
offset from a standard model. Leave at `0` otherwise.

### `positionMode`
**Default: `'geometric'`** · `'geometric' | 'apparent'`

Whether to report where a body **is** or where it is **seen**.

- `'geometric'` — no light-time, aberration or gravitational deflection. This is
  Jyotish convention and what JHora does.
- `'apparent'` — the astronomical standard; matches JPL Horizons and where a
  telescope points.

They differ by up to **~44″** (Venus near conjunction; the Sun ~21″, Saturn ~7″),
so this is not cosmetic.

### `topocentric` / `altitudeMetres`
**Default: `false` / `0`**

Correct for the observer's position on Earth's surface rather than its centre.
Matters almost only for the Moon, where parallax reaches ~1°.

### `nodeType`
**Default: `'true'`** · `'mean' | 'true'`

Rahu/Ketu from the mean node or the true (osculating) node. They differ by up to
~1.6°, so this materially changes house placement. JHora uses `'true'`; many
practitioners prefer the smoothed `'mean'` node.

### `houseSystem`
**Default: `'WholeSign'`** · `'WholeSign' | 'Equal' | 'Placidus' | 'Porphyry'`

Whole Sign is the Parashari standard.

### `dasamsaScheme`
**Default: `'parashara'`** · `'parashara' | 'jhora_5_8'`

The D10 rule for **even** signs. Odd signs are identical under both.

- `'parashara'` — BPHS: ten parts counted forward from the **9th** sign.
- `'jhora_5_8'` — JHora's variant: counted **backward from the 5th** sign, with
  the degree reversed within each part.

> This is the one place the library deliberately does **not** follow JHora.
> JHora's `(5-8)` scheme has no basis in BPHS. Set `'jhora_5_8'` to reproduce
> JHora's D10 exactly.

Only D10 is affected; every other varga has a single unambiguous rule.

### `sunriseHour`
**Default: `6.0`** · decimal hours, local

The Vedic weekday (vara) begins at sunrise, not midnight. Supply the real
sunrise for the birth place; the default is a nominal 6 a.m.

### `dashaYearDays`
**Default: `365.242189623`** (tropical year)

Length of a Vimshottari dasha year. Some traditions use 360 (savana) or 365.25
(Julian).

---

## Setting them

### Per call — strongest

```ts
import { calculateVarga, EphemerisEngine } from '@node-jhora/core';

const engine = EphemerisEngine.getInstance();
await engine.initialize();

engine.getPlanets(date, location, {
  ayanamsaOrder: 27,
  positionMode:  'apparent',
  nodeType:      'mean',
});

calculateVarga(lon, 10, { dasamsaScheme: 'jhora_5_8' });
```

### Per instance

```ts
import { NodeJHora } from '@node-jhora/core';

const chart = new NodeJHora(
  { latitude: 13.0833, longitude: 80.2833 },
  { ayanamsaMode: 27, nodeType: 'mean', houseSystem: 'Equal' },
);

chart.getPlanets(date);                          // instance defaults
chart.getPlanets(date, { nodeType: 'true' });    // per-call override wins
```

### Reproducing JHora exactly

```ts
import { NodeJHora, JHORA_PRESET } from '@node-jhora/core';

const chart = new NodeJHora(location, JHORA_PRESET);
```

`JHORA_PRESET` sets True Chitrapaksha, geometric positions, the true node, and
`dasamsaScheme: 'jhora_5_8'`. Verified against a real JHora export: every D1 body
to **0.01″**, ascendant **0.00″**, D9 **0.1″**, D10 **0.5″**.

### Over the REST API

Every option is a field on the request body:

```json
{
  "date": "1998-12-06",
  "time": "09:23:00",
  "latitude": 13.0833,
  "longitude": 80.2833,
  "timezone": "Asia/Kolkata",

  "ayanamsa": "true_chitra",
  "ayanamsaOffset": 0,
  "positionMode": "geometric",
  "topocentric": false,
  "altitudeMetres": 0,
  "nodeType": "true",
  "houseSystem": "whole_sign",
  "dasamsaScheme": "parashara",
  "sunriseHour": 6
}
```

`ayanamsa` accepts: `true_chitra`, `true_pushya`, `true_revati`, `true_mula`,
`lahiri`, `lahiri_icrc`, `raman`, `kp`, `yukteshwar`, `fagan_bradley`.

---

## Accuracy

Measured, not asserted. Reproduce with the tools in `tools/`.

| Comparison | Result |
|---|---|
| Tropical longitudes vs **JPL Horizons**, 1900–2024 | ≤ **0.28″** (typically 0.04″) |
| vs **JHora** export, 1998 chart, `JHORA_PRESET` | D1 **0.01″**, ascendant **0.00″** |
| vs JHora's own stored `.jhd` values, scored against Horizons | node-jhora closer on **4/4** charts, by 3×–113× |

```bash
node tools/verify-jhd.mjs data/          # check charts against JHora .jhd files
node tools/benchmark-vs-jhora.mjs        # three-way accuracy benchmark
```

**Coverage:** the DE440s kernel spans **1849-12-26 to 2150-01-22**. Outside that
range the engine reports an explicit coverage error rather than extrapolating.

**Future dates:** ΔT cannot be predicted. Past 2025 the engine extrapolates while
JPL Horizons freezes ΔT, so the two legitimately diverge — ~46″ of lunar motion
by 2100. That is a property of Earth's rotation, not an engine defect.
