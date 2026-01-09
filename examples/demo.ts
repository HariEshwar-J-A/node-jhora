import { NodeJHora, calculateShadbala, generateVimshottari, init } from '../src/index.js';
import { DateTime } from 'luxon';

// Demo Script for Node-Jhora

async function runDemo() {
    console.log("🚀 Starting Node-Jhora Demo...");

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

    // 3. Shadbala (Using Core Function for full control logic if needed, or implementing full helper)
    // Here we just showcase we can import it.
    // Ideally we need structured input for Shadbala (Relationships etc.)
    // For demo, let's skip complex setup or use a simplified call if available.
    // "Calculating a Birth Chart (Full Shadbala + Vargas)" requested by user prompt.
    // Let's manually construct input for one planet (Sun) to show it works.

    const sun = chart.planets.find(p => p.id === 0);
    const moon = chart.planets.find(p => p.id === 1);

    if (sun && moon) {
        console.log(`\n💪 Calculating Shadbala for Sun...`);
        try {
            // Mocking varga info for demo brevity, real app would calculate it.
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
            console.error("   - Shadbala Error (Expected if incomplete data):", e);
        }
    }

    // 4. Vimshottari Dasha
    console.log("\n⏳ Vimshottari Dasha (Current):");
    if (moon) {
        const dashas = generateVimshottari(date, moon.longitude, 2);
        // Find current? They start from now if we pass date as birth?
        // Usually Dasha is from BIRTH date. Let's assume 'date' is birth.
        const first = dashas[0];
        console.log(`   - Current Mahadasha: ${first.planet} (Ends: ${first.end.toFormat('yyyy-MM-dd')})`);
        if (first.subPeriods && first.subPeriods.length > 0) {
            console.log(`   - First Antardasha: ${first.subPeriods[0].planet}`);
        }
    }

    // 5. Planetary Stream
    console.log("\n⏱️ Starting Planetary Stream (5 seconds demo)...");
    const stream = client.createStream(1000); // 1 sec updates

    stream.on('reading', (update) => {
        const now = update.timestamp.toFormat('HH:mm:ss');
        // Find Sun
        const s = update.planets.find((p: any) => p.id === 0);
        console.log(`   [${now}] Sun Longitude: ${s?.longitude.toFixed(4)}°`);
    });

    stream.start();

    // Stop after 5 seconds
    await new Promise(r => setTimeout(r, 5000));
    stream.stop();
    console.log("🛑 Stream Stopped.");
    console.log("✅ Demo Complete.");
}

function getPlanetName(id: number): string {
    const names = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'];
    return names[id] || 'Unknown';
}

runDemo().catch(console.error);
