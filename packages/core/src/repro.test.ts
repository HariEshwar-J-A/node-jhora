
import { EphemerisEngine } from './engine/ephemeris.js';
import { calculatePanchanga } from './vedic/panchanga.js';
import { DateTime } from 'luxon';
import { decimalToDms } from './core/math.js';

(async () => {
    const engine = EphemerisEngine.getInstance();
    await engine.initialize();

    const date = DateTime.fromISO('1998-12-06T09:23:00', { zone: 'Asia/Kolkata' });
    const location = { latitude: 13.0827, longitude: 80.2707 }; 

    const planets = engine.getPlanets(date, location, {
        ayanamsaOrder: 1,
        nodeType: 'true',
        ayanamsaOffset: 0.0818
    });
    
    const sun = planets.find(p => p.name === 'Sun');
    const moon = planets.find(p => p.name === 'Moon');

    console.log('--- PANCHANGA CHECK ---');
    if (sun && moon) {
         const panchanga = calculatePanchanga(sun.longitude, moon.longitude, date);
         console.log(`Tithi: ${panchanga.tithi.name} (${panchanga.tithi.id})`);
         console.log(`Nakshatra: ${panchanga.nakshatra.name} (${panchanga.nakshatra.id})`);
         console.log(`Yoga: ${panchanga.yoga.name}`);
         console.log(`Karana: ${panchanga.karana.name}`);
    } else {
        console.log('Sun/Moon missing');
    }
})();
