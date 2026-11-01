# Market positioning

Comparative notes for **node-jhora** in the Vedic astrology developer landscape. This is product context, not a performance guarantee — see [accuracy.md](../accuracy.md) and [performance.md](../performance.md) for measured floors.

---

## Landscape

1. **Astronomical engines** — high-precision ephemerides (often C/C++ libraries) that expose raw positions without Jyotish conventions.
2. **Fragmented libraries** — single-purpose JS/Python ports covering charts or dashas only.
3. **SaaS APIs** — hosted black-box results with limited algorithmic transparency.

node-jhora targets **self-hosted**, **modular** JavaScript: JPL DE440s astrometry in pure TypeScript, Jyotish conventions and vargas in `@node-jhora/core`, with optional HTTP (`@node-jhora/api`) and PDF reporting.

---

## Comparison (high level)

| Dimension         |    Typical JS libs     |  Hosted APIs   |                  **node-jhora**                  |
| :---------------- | :--------------------: | :------------: | :----------------------------------------------: |
| Ephemeris         |     Approximations     | Opaque backend |      **JPL DE440s (TypeScript SPK reader)**      |
| Licensing         |         Varies         |  Subscription  |  **Proprietary source-available (see LICENSE)**  |
| Packages          |        Monolith        |     Closed     |          **Scoped workspace packages**           |
| Match             |     Often missing      |   One system   |     **Ashta Kuta, Dasha Kuta, Mangal Dosha**     |
| Dashas            | Often Vimshottari only |     Broad      | **Vimshottari, Yogini, Narayana, Jaimini Chara** |
| HTTP server       |          Rare          |   Cloud only   |      **`@node-jhora/api` (Fastify + Zod)**       |
| Accuracy evidence |      Unpublished       |      N/A       |  **Horizons + reference-oracle golden suites**   |

---

## Differentiators

### DE440s without WASM or AGPL ephemeris bundles

The default kernel is **`de440s.bsp`** via `@node-jhora/ephe`. Positions are computed in TypeScript; there is no WASM binary and no Swiss Ephemeris dependency in the runtime graph. Optional long-range **NJCE** chunks and **DE441** truth profiles extend coverage when those data packages are installed.

### Modular monorepo

Install only what you need: `core`, `analytics`, `prediction`, `match`, `events`, `reporting`, `api`, `format`, `engine`, `atlas`, and data packages `ephe` / `ephe-long` / `ephe441` / `eop`.

### Precision profiles

`jhora` and `modern` profiles are pinned for byte-identical compatibility with established desktop reference oracles where documented; `truth` (+ optional EOP) follows JPL/IERS-oriented ΔT and nutation for research. See [precision profiles](./precision-profiles.md).

### Production API

`@node-jhora/api` exposes chart, varga, panchanga, dasha, transit, shadbala, KP, and match routes with Zod validation. Deploy on Node, Bun, or edge workers with an injected kernel buffer — [server guide](./server.md).

### Math documentation

Algorithm notes live in [math.md](./math.md) and [derivations/houses.md](./derivations/houses.md). Golden fixtures record literal reference-oracle strings where applicable; they are not copied source.

---

## Not claimed here

- **PlanetaryStream** is exported as a stub in current releases; do not market it as a live streaming product until implemented.
- **Open source** in the sense of MIT/Apache — this repository is **source-available**; commercial use requires a license from the owner (see root LICENSE and package READMEs).
