import { FastifyInstance } from 'fastify';
import { calculateHouseCusps, calculateVarga } from '@node-jhora/core';
import { calculateShadbala, VargaInfo } from '@node-jhora/analytics';
import { getEngine } from '../server.js';
import { BirthInputSchema } from '../schemas/birth-input.js';
import { parseBirthInput } from '../schemas/helpers.js';

// The 7 vargas used in Saptavargaja Bala (BPHS): D1, D2, D3, D7, D9, D12, D30
const SAPTAVARGA_DIVISIONS = [1, 2, 3, 7, 9, 12, 30];

// Standard sign → lord mapping (0-indexed sign 0-11)
const SIGN_LORDS: number[] = [4, 3, 2, 1, 0, 2, 3, 4, 5, 6, 6, 5]; // Mars, Venus, Merc, Moon, Sun, Merc, Venus, Mars, Jup, Sat, Sat, Jup

function buildVargaPositions(
    planetLon: number,
    planetRashiSign: number,
    allPlanets: any[],
): VargaInfo[] {
    return SAPTAVARGA_DIVISIONS.map(d => {
        const vp   = calculateVarga(planetLon, d);
        const sign = vp.sign; // 1-12
        const lordId = SIGN_LORDS[sign - 1]; // planet ID of sign ruler

        // Rashi sign of the lord: find the lord planet in allPlanets
        const lordPlanet = allPlanets.find(p => p.id === lordId);
        const lordRashiSign = lordPlanet
            ? Math.floor(lordPlanet.longitude / 30) + 1
            : 1;

        return {
            vargaName: `D${d}`,
            sign,
            lordId,
            lordRashiSign,
        };
    });
}

// Simple sunrise/sunset estimation (±6h from local noon as approximation)
function estimateSunriseSunset(lat: number): { sunrise: number; sunset: number } {
    // Rough approximation using latitude: ±6h around solar noon at equinox
    const halfDay = 6 + Math.abs(lat) / 90 * 3;
    return { sunrise: 12 - halfDay, sunset: 12 + halfDay };
}

export async function shadbalaRoutes(app: FastifyInstance): Promise<void> {
    app.post('/shadbala', async (req, reply) => {
        const input = BirthInputSchema.parse(req.body);
        const { dt, location, ayanamsaOrder, nodeType, houseSystem } = parseBirthInput(input);
        const engine = getEngine();

        const planets = engine.getPlanets(dt, location, { ayanamsaOrder, nodeType });
        const housesResult = calculateHouseCusps(dt, location.latitude, location.longitude, houseSystem as any, engine);

        const houses = {
            cusps:     housesResult.cusps,
            ascendant: housesResult.ascendant,
            mc:        housesResult.mc,
            armc:      housesResult.armc,
            vertex:    housesResult.vertex ?? 0,
        };

        const sun  = planets.find(p => p.id === 0)!;
        const moon = planets.find(p => p.id === 1)!;

        const birthHour    = dt.hour + dt.minute / 60 + dt.second / 3600;
        const { sunrise, sunset } = estimateSunriseSunset(location.latitude);

        // Calculate shadbala for the 7 classical planets (Sun–Saturn, IDs 0–6)
        const results = planets
            .filter(p => p.id >= 0 && p.id <= 6)
            .map(planet => {
                const vargaPositions = buildVargaPositions(
                    planet.longitude,
                    Math.floor(planet.longitude / 30) + 1,
                    planets,
                );
                const shadbala = calculateShadbala({
                    planet,
                    allPlanets: planets,
                    houses,
                    sun,
                    moon,
                    timeDetails: { birthHour, sunrise, sunset },
                    vargaPositions,
                });
                return {
                    planetId:   planet.id,
                    planetName: planet.name,
                    rupas:      +(shadbala.total / 60).toFixed(4),
                    virupas:    +shadbala.total.toFixed(4),
                    components: {
                        sthana:     +shadbala.sthana.toFixed(4),
                        dig:        +shadbala.dig.toFixed(4),
                        kaala:      +shadbala.kaala.toFixed(4),
                        chesta:     +shadbala.chesta.toFixed(4),
                        naisargika: +shadbala.naisargika.toFixed(4),
                        drig:       +shadbala.drig.toFixed(4),
                    },
                    breakdown: {
                        uchcha:       +shadbala.breakdown.uchcha.toFixed(4),
                        saptavargaja: +shadbala.breakdown.saptavargaja.toFixed(4),
                        kendra:       +shadbala.breakdown.kendra.toFixed(4),
                        ojayugma:     +shadbala.breakdown.ojayugma.toFixed(4),
                        natonata:     +shadbala.breakdown.natonata.toFixed(4),
                        paksha:       +shadbala.breakdown.paksha.toFixed(4),
                        tribhaga:     +shadbala.breakdown.tribhaga.toFixed(4),
                        ayana:        +shadbala.breakdown.ayana.toFixed(4),
                    },
                    ishtaPhala:  +shadbala.ishtaPhala.toFixed(4),
                    kashtaPhala: +shadbala.kashtaPhala.toFixed(4),
                };
            });

        return reply.status(200).send({ shadbala: results });
    });
}
