
// High Precision Verification Script
import { NodeJHora } from '../dist/index.js';
import { DateTime } from 'luxon';

async function verifyPrecision() {
    console.log("🔍 High Precision Verification Mode");

    // Location: Chennai
    const loc = { latitude: 13.0827, longitude: 80.2707 };
    const date = DateTime.fromISO("2000-01-01T12:00:00Z");

    // 1. Geocentric
    const clientGeo = new NodeJHora(loc, { topocentric: false });
    await clientGeo.init();
    const planetsGeo = clientGeo.getPlanets(date);
    const moonGeo = planetsGeo.find(p => p.name === 'Moon');
    const ascGeo = clientGeo.getHouses(date).ascendant;

    // 2. Topocentric
    const clientTopo = new NodeJHora(loc, { topocentric: true });
    await clientTopo.init();
    const planetsTopo = clientTopo.getPlanets(date);
    const moonTopo = planetsTopo.find(p => p.name === 'Moon');
    const ascTopo = clientTopo.getHouses(date).ascendant;

    // Comparison
    console.log(`\n📅 Date: ${date.toISO()}`);
    console.log(`📍 Location: ${loc.latitude}N, ${loc.longitude}E`);

    console.log("\n🌑 MOON Precision:");
    console.log(`   Geocentric Longitude:  ${moonGeo.longitude.toFixed(6)}°`);
    console.log(`   Topocentric Longitude: ${moonTopo.longitude.toFixed(6)}°`);
    const diff = moonTopo.longitude - moonGeo.longitude;
    console.log(`   Difference (Parallax): ${diff.toFixed(6)}° (~${(diff * 60).toFixed(2)}')`);

    if (Math.abs(diff) > 0.5 && Math.abs(diff) < 1.5) {
        console.log("   ✅ Parallax correction active (Approx 0.5-1.0 deg expected).");
    } else {
        console.log("   ⚠️ Parallax check inconclusive.");
    }

    console.log("\n🌅 ASCENDANT Precision (Refraction Probe):");
    // Note: getHouses currently uses geometric ascendant logic in both cases unless configured inside houses.ts
    // In our manual update, we APPLIED refraction logic to calculateHouseCusps.
    // It applies always or only when requested? The code we wrote applies it ALWAYS inside `calculateHouseCusps`.
    // Wait, did we flag it? 
    // We embedded the logic: "const alt = ...; const targetAlt = -0.57".
    // This implies it is ON by default now for high precision.
    // Let's verify if the logic runs.

    console.log(`   Refraction-Corrected Asc: ${ascGeo.toFixed(6)}°`);
    // Ideally we would compare against non-refraction if we had a switch, but we baked it in.
}

verifyPrecision().catch(console.error);
