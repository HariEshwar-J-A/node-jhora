# Node-Jhora 🪐

A high-performance, "Clean Room" Vedic Astrology (Jyotish) calculation engine for Node.js and TypeScript. 

Build powerful astrology applications with a copyright-free, dependency-light engine that implements the **Brihat Parashara Hora Shastra (BPHS)** algorithms from first principles.

## Features ✨

- **High Precision Ephemeris**: Built on `swisseph-wasm` (Swiss Ephemeris) for accurate planetary positions (Sidereal/Nirayana).
- **Vedic Calendar (Panchanga)**: Calculates Tithi, Nakshatra, Yoga, Karana, and Vara.
- **Divisional Charts (Vargas)**: Supports D1, D9 (Navamsa), D10 (Dasamsa), D60 (Shashtyamsa), and more.
- **Planetary Strength (Shadbala)**: Complete 6-fold strength calculation (Sthana, Dig, Kaala, Chesta, Naisargika, Drig) compliant with BPHS.
- **Predictive Timing (Dasha)**: Vimshottari Dasha engine with support for custom depths and balance correction.
- **Real-Time Stream**: Lightweight EventEmitter for building astronomical clocks or animations.
- **House Systems**: Whole Sign, Porphyry (Sri Pati), and Placidus (experimental).
- **Geocoder**: Built-in offline city lookup (23,000+ cities) with zero runtime memory overhead.

## Installation 📦

```bash
npm install node-jhora
```

## Quick Start 🚀

### 1. Initialize the Engine
The engine requires a one-time async initialization to load the WASM modules.

```typescript
import { NodeJHora } from 'node-jhora';
import { DateTime } from 'luxon';

// Initialize for a specific location (e.g., Chennai)
const client = new NodeJHora({ 
    latitude: 13.0827, 
    longitude: 80.2707 
});

await client.init();
```

### 2. Calculate a Horoscope (Chart)
Get planetary positions and house cusps for a specific date and time.

```typescript
const date = DateTime.now();
const chart = client.getChart(date);

// Planetary Positions (D1 Rashi)
chart.planets.forEach(planet => {
    // longitude is 0-360 degrees
    const sign = Math.floor(planet.longitude / 30) + 1;
    console.log(`${planet.name}: ${planet.longitude.toFixed(2)}° (Sign ${sign})`);
});

// House Cusps (Ascendant/Lagna)
console.log(`Ascendant: ${chart.houses.ascendant.toFixed(2)}°`);
```

### 3. Vedic Panchanga
Calculate the five limbs of time.

```typescript
const panchanga = client.getPanchanga(date);

console.log(`Tithi: ${panchanga.tithi.name} (${panchanga.tithi.percent.toFixed(1)}% left)`);
console.log(`Nakshatra: ${panchanga.nakshatra.name} - Pada ${panchanga.nakshatra.pada}`);
console.log(`Yoga: ${panchanga.yoga.name}`);
console.log(`Karana: ${panchanga.karana.name}`);
```

### 4. Divisional Charts (Vargas)
Calculate positions in any varga (D1-D60).

```typescript
// Calculate Navamsa (D9) for the Sun
const sun = chart.planets.find(p => p.name === 'Sun');
const d9 = client.calculateVarga(sun.longitude, 9);

console.log(`Sun in D9: ${d9.sign} (Sign Index) @ ${d9.degree.toFixed(2)}°`);
```

### 5. Shadbala (Planetary Strength)
Calculate the comprehensive strength of planets (requires sunrise/sunset info).

```typescript
// Shadbala requires a few more details about the day
const shadbala = client.getShadbala(
    date, 
    date.hour, // Birth Hour
    6,  // Sunrise Hour (approx or calculated)
    18  // Sunset Hour
);

console.log(`Total Strength (Virupas): ${shadbala.total}`);
console.log(`Ishta Phala: ${shadbala.ishtaPhala}`);
console.log(`Kashta Phala: ${shadbala.kashtaPhala}`);
```

### 6. Vimshottari Dasha
Generate the predictive timeline.

```typescript
const moon = chart.planets.find(p => p.name === 'Moon');

// Generate Dasha tree (Mahadasha -> Antardasha)
const dashas = client.generateVimshottari(date, moon.longitude);

const current = dashas[0];
console.log(`Current Mahadasha: ${current.planet}`);
console.log(`Ends: ${current.end.toFormat('yyyy-MM-dd')}`);
```

### 7. Real-Time Planetary Stream
Emit events for building real-time clocks.

```typescript
const stream = client.createStream(1000); // Update every 1 second

stream.on('reading', (update) => {
    const sun = update.planets.find(p => p.name === 'Sun');
    console.log(`[${update.timestamp.toISOTime()}] Sun: ${sun.longitude.toFixed(4)}`);
});

stream.start();
// stream.stop() to halt
```

## Configuration ⚙️

You can configure the Ayanamsa (Precession calculation) when initializing.

```typescript
const client = new NodeJHora(location, {
    ayanamsaOrder: 1 // 1 = Lahiri (Default), 3 = Raman, 5 = KP, etc. (uses SwissEph codes)
});
```

## Architecture 🏗️

- **`src/engine`**: Core astronomy (SwissEph WASM + Geocoder).
- **`src/vedic`**: Astrological logic (Panchanga, Vargas, Houses).
- **`src/analytics`**: mathematical models for strength (Shadbala, Aspects).
- **`src/predictive`**: Time-related prediction systems (Dasha).
- **`src/stream`**: Event-driven engine.

## License �

**UNLICENSED / PROPRIETARY.**

All rights reserved. This software is the confidential and proprietary information of the author.

**Commercial use, redistribution, or modification is prohibited without a specific commercial license agreement.** 

If you wish to use this engine in a commercial product, please contact the author for licensing and payment details.
