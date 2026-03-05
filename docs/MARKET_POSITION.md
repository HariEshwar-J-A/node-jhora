# Market Positioning Analysis

This document provides a comparative analysis of **Node-Jhora** against current industry standards and developer tools in the Vedic astrology space.

---

## 📊 Market Overview

The Vedic astrology developer landscape is currently split into three categories:

1.  **Astronomical Engines**: High-precision C++/WASM binaries (e.g., Swiss Ephemeris) that provide raw data but lack astrological logic.
2.  **Hardcoded Libraries**: Fragmented, often outdated libraries in JS or Python that handle specific tasks (e.g., just charts or just Vimshottari).
3.  **SaaS APIs**: High-cost, monthly-subscription APIs (e.g., Prokerala, Vedic Rishi) that provide black-box results with no algorithmic transparency.

Node-Jhora fills the gap as the **only modular, high-precision, open-source JavaScript SDK** bridging raw astronomy and high-level Jyotish logic.

---

## ⚖️ Node-Jhora vs. Competitors

| Feature | Single-Purpose JS Libs | SaaS APIs (Prokerala etc.) | **Node-Jhora** |
| :--- | :---: | :---: | :---: |
| **Precision Source** | Approximations / Moshier | Swiss Ephemeris | **Swiss Ephemeris (WASM)** |
| **Modular Architecture** | No | Closed Source | **7 Scoped NPM Packages** |
| **Shadbala Depth** | Basic / Missing | Black-box | **Full Parashara (6-fold)** |
| **Multiple Dashas** | Vimshottari Only | Comprehensive | **Vimshottari, Yogini, Narayana, Chara** |
| **Yoga Engine** | Hardcoded | Comprehensive | **Rule-Based & Extensible (JSON)** |
| **KP System** | Missing | Limited | **Sub-lords + KP Engine Significators** |
| **Match Systems** | Basic / Missing | Single System | **Ashta Kuta + Dasha Kuta + Mangal Dosha** |
| **Production API** | None | Cloud Only ($$$) | **Self-Hosted Fastify + Zod** |
| **Event Detection** | None | None | **Binary Search + Newton-Raphson** |
| **PDF Reports** | None | Proprietary | **Open PDFKit-based Generation** |
| **Real-time Streaming** | No | No (Request-Response) | **Yes (PlanetaryStream)** |
| **Deployment** | Local / Browser | Cloud Only ($$$) | **Local / Edge / Browser / Docker** |
| **Precision Math** | Native float | Unknown | **Decimal.js (arbitrary precision)** |
| **Transparency** | Varies | Black Box | **Open Source, Documented Math** |

---

## 🚀 Key Differentiators

### 1. The "WASM High-Precision" Advantage

Most JavaScript libraries prioritize small bundle sizes and use trigonometric approximations for planetary positions. This leads to **drift over several centuries**. Node-Jhora uses the official Swiss Ephemeris WASM binary, providing the same accuracy (0.0001″) as professional desktop software like *Jagannatha Hora* and *Shri Jyoti Star*.

### 2. Tiered Monorepo Architecture

Instead of a monolithic blob, Node-Jhora is a **professional SDK with 7 scoped packages**:

| Use Case | Packages Needed |
| :--- | :--- |
| Lightweight astronomy app | `@node-jhora/core` only |
| Compatibility check tool | `core` + `match` |
| Full prediction platform | `core` + `analytics` + `prediction` |
| Enterprise API service | `core` + `analytics` + `prediction` + `match` + `api` |
| Complete astrology suite | All packages |

This modularity is **unique** in the open-source Vedic astrology market.

### 3. Production-Ready REST API

Node-Jhora ships with `@node-jhora/api` — a **Fastify server** with:
- **Zod schemas** for compile-time type safety and runtime validation.
- **7 API endpoints** covering charts, vargas, panchanga, dashas, shadbala, KP, and matching.
- **Pino structured logging** for production observability.
- **CORS support** for web frontend integration.

No other open-source Vedic library ships with a ready-to-deploy API server.

### 4. High-Frequency UI Support

Most astrology engines are built for static "PDF reports." Node-Jhora includes:
- **Ephemeris Interpolator**: 60fps smooth planetary animations without overloading WASM (~5ms savings per frame).
- **PlanetaryStream**: Observable real-time data feed for live dashboards and Prashna applications.

### 5. Precision Event Detection

Two complementary algorithms for finding exact astronomical moments:
- **Binary Search (TransitScanner)**: Generic condition-flip detection for sign ingresses and retrograde stations.
- **Newton-Raphson (TransitEngine)**: Quadratically-convergent aspect timing with `1e-7` degree tolerance.

No other JS library offers both approaches.

### 6. Comprehensive Matchmaking

While most libraries offer a single matching method, Node-Jhora provides:
- **Ashta Kuta (North Indian)**: Full 36-point scoring across 8 kutas.
- **Dasha Kuta (South Indian)**: 10 Poruthams with Vedha and Rajju critical checks.
- **Mangal Dosha**: Mars defect analysis with Parashara exception rules.

### 7. Mathematical Transparency

Unlike proprietary APIs where the logic for *Ishta Phala*, *Narayana Dasha*, or *Arudha Padas* is hidden, Node-Jhora provides:
- **First-principles documentation** ([MATH.md](./MATH.md)) explaining every algorithm.
- **Decimal.js precision** math that can be audited and verified.
- **Open source** implementation suitable for research and academic-grade astrology applications.

### 8. Jaimini & KP as First-Class Citizens

While most libraries focus on Parashari basics, Node-Jhora treats advanced systems as core features:
- **Jaimini**: Chara Karakas (7-karaka system), Arudha Padas (with exception rules), Chara Dasha.
- **KP (Krishnamurti Paddhati)**: Sub-lord tables, Ruling Planets, and extended KP Engine significators.

---

## 🏁 Conclusion

Node-Jhora stands as the **only high-precision, modular JavaScript SDK** that bridges the gap between raw astronomical data and high-level astrological logic. With 7 specialized packages, a production-ready API, precision event detection, comprehensive matchmaking, and full mathematical transparency, it is the modern, self-hostable alternative to expensive enterprise APIs and fragmented legacy libraries.
