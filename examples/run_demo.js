import { NodeJHora, calculateShadbala, generateVimshottari, init } from '../dist/index.js';
import { DateTime } from 'luxon';

// Demo Script for Node-Jhora (Running against DIST)

async function runDemo() {
    console.log("🚀 Starting Node-Jhora Demo (Built Artifact)...");

    // 1. Initialize
    console.log("Initializing Engine...");
    const client = new NodeJHora({ latitude: 13.0827, longitude: 80.2707 }); // Chennai
    await client.init();

    // 2. Calculate Chart
    const date = DateTime.now();
    console.log(`\n📅 Calculating Chart for: ${date.toISO()}`);
    const chart = client.getChart(date);

    console.log("🪐 Planetary Positions (D1):");
    chart.planets.forEach(p => {
        const sign = Math.floor(p.longitude / 30) + 1;
        console.log(`   - ${getPlanetName(p.id)}: ${p.longitude.toFixed(2)}° (Sign ${sign})`);
    });

    console.log("\n🏠 House Cusps (D1 - Whole Sign / Asc):");
    console.log(`   - Ascendant: ${chart.houses.ascendant.toFixed(2)}°`);

    // 3. Shadbala
    const sun = chart.planets.find(p => p.id === 0);
    const moon = chart.planets.find(p => p.id === 1);

    if (sun && moon) {
        console.log(`\n💪 Calculating Shadbala for Sun...`);
        try {
            // Mocking varga info for demo brevity
            const vargaMock = [{ vargaName: 'D1', sign: Math.floor(sun.longitude / 30) + 1, lordId: 0, lordRashiSign: 0 }];
            const result = calculateShadbala({
                planet: sun,
                allPlanets: chart.planets,
                houses: chart.houses,
                sun: sun,
                moon: moon,
                timeDetails: { sunrise: 6, sunset: 18, birthHour: date.hour },
                vargaPositions: vargaMock
            });
            console.log(`   - Total Shadbala (Sun): ${result.total.toFixed(2)} Virupas`);
        } catch (e) {
            console.error("   - Shadbala Error:", e.message);
        }
    }

    // 4. Vimshottari Dasha
    console.log("\n⏳ Vimshottari Dasha (Current):");
    if (moon) {
        const dashas = generateVimshottari(date, moon.longitude, 2);
        const first = dashas[0];
        console.log(`   - Current Mahadasha: ${first.planet} (Duration: ${first.durationYears.toFixed(2)}y)`);
    }

    // 5. Planetary Stream
    console.log("\n⏱️ Starting Planetary Stream (3 seconds demo)...");
    const stream = client.createStream(1000); // 1 sec updates

    stream.on('reading', (update) => {
        const now = update.timestamp.toFormat('HH:mm:ss');
        const s = update.planets.find(p => p.id === 0);
        console.log(`   [${now}] Sun Longitude: ${s?.longitude.toFixed(4)}°`);
    });

    stream.start();

    await new Promise(r => setTimeout(r, 3500));
    stream.stop();
    console.log("🛑 Stream Stopped.");
    console.log("✅ Demo Complete.");
}

function getPlanetName(id) {
    const names = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'];
    return names[id] || 'Unknown';
}

runDemo().catch(console.error);
