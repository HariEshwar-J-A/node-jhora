# Market Positioning Analysis

This document provides a comparative analysis of **Node-Jhora** against current industry standards and developer tools in the Vedic astrology space.

## 📊 Market Overview

The Vedic astrology developer landscape is currently split into three categories:
1.  **Astronomical Engines**: High-precision C++/WASM binaries (e.g., Swiss Ephemeris) that provide raw data but lack astrological logic.
2.  **Hardcoded Libraries**: Fragmented, often outdated libraries in JS or Python that handle specific tasks (e.g., just charts or just Vimshottari).
3.  **SaaS APIs**: High-cost, monthly-subscription APIs (e.g., Prokerala, Vedic Rishi) that provide black-box results.

---

## ⚖️ Node-Jhora vs. Competitors

| Feature | Single-Purpose JS Libs | SaaS APIs (Prokerala etc) | **Node-Jhora** |
| :--- | :---: | :---: | :---: |
| **Precision Source** | Approximations / Moshier | Swiss Ephemeris | **Swiss Ephemeris (WASM)** |
| **Monorepo Architecture** | No | Closed Source | **Yes (Scoped Packages)** |
| **Shadbala Depth** | Basic / Missing | Black-box | **Full Parashara Implemention** |
| **Multiple Dashas** | Vimshottari Only | Comprehensive | **Vimshottari, Yogini, Narayana** |
| **Yoga Engine** | Hardcoded | Comprehensive | **Rule-Based & Extensible** |
| **Real-time Streaming** | No | No (Request-Response) | **Yes (PlanetaryStream)** |
| **Deployment** | Local / Browser | Cloud Only ($$$) | **Local / Edge / Browser** |

---

## 🚀 Key Differentiators

### 1. The "WASM High-Precision" Advantage
Most JavaScript libraries prioritize small bundle sizes and use trigonometric approximations for planetary positions. This leads to drift over several centuries. **Node-Jhora** uses the official Swiss Ephemeris WASM binary, providing the same accuracy (0.0001") as professional desktop software like *Jagannatha Hora*.

### 2. Tiered Monorepo Logic
Instead of a monolithic blob, Node-Jhora is a professional SDK. A developer can use only `@node-jhora/core` for a lightweight astronomical app, or add `@node-jhora/prediction` for an enterprise lifecycle app. This modularity is unique in the open-source market.

### 3. High-Frequency UI Support
Most astrology engines are built for static "PDF reports." Node-Jhora includes an **Ephemeris Interpolator**, allowing for 60fps smooth planetary animations for mobile/web dashbords without overloading the WASM module.

### 4. Mathematical Transparency
Unlike proprietary APIs where the logic for "Ishta Phala" or "Narayana Dasha" is hidden, Node-Jhora provides first-principles documentation (`MATH.md`) and open logic, making it suitable for research and academic-grade astrology apps.

### 5. Jaimini & KP Native Support
While most libraries focus on Parashari basics, Node-Jhora treats Jaimini (Karakas, Arudhas, Chara Dasha) and KP (Sub-lords) as first-class citizens, implemented with "clean room" precision.

## 🏁 Conclusion
Node-Jhora stands as the **only high-precision, modular JavaScript SDK** that bridges the gap between raw astronomical data and high-level astrological logic. It is the modern, open-source alternative to expensive enterprise APIs and fragmented legacy libraries.
