import { calculateShadbala, type VargaInfo } from '@node-jhora/analytics';
import { Body, calculateVarga, type PlanetPosition } from '@node-jhora/core';

import type { SerializableShadbalaRow } from '../types.js';

const SAPTAVARGA_DIVISIONS = [1, 2, 3, 7, 9, 12, 30];
const SIGN_LORDS: number[] = [
    Body.Mars,
    Body.Venus,
    Body.Mercury,
    Body.Moon,
    Body.Sun,
    Body.Mercury,
    Body.Venus,
    Body.Mars,
    Body.Jupiter,
    Body.Saturn,
    Body.Saturn,
    Body.Jupiter,
];

function buildVargaPositions(planetLon: number, allPlanets: PlanetPosition[]): VargaInfo[] {
    return SAPTAVARGA_DIVISIONS.map((d) => {
        const vp = calculateVarga(planetLon, d);
        const sign = vp.sign;
        const lordId = SIGN_LORDS[sign - 1];
        const lordPlanet = allPlanets.find((p) => p.id === lordId);
        const lordRashiSign = lordPlanet ? Math.floor(lordPlanet.longitude / 30) + 1 : 1;
        return { vargaName: `D${d}`, sign, lordId, lordRashiSign };
    });
}

function estimateSunriseSunset(lat: number): { sunrise: number; sunset: number } {
    const halfDay = 6 + (Math.abs(lat) / 90) * 3;
    return { sunrise: 12 - halfDay, sunset: 12 + halfDay };
}

export function computeShadbalaSection(
    planets: PlanetPosition[],
    houses: {
        cusps: number[];
        ascendant: number;
        mc: number;
        armc: number;
        vertex?: number;
    },
    birthHour: number,
    latitude: number,
): SerializableShadbalaRow[] {
    const sun = planets.find((p) => p.id === Body.Sun)!;
    const moon = planets.find((p) => p.id === Body.Moon)!;
    const { sunrise, sunset } = estimateSunriseSunset(latitude);

    return planets
        .filter((p) => p.id >= Body.Sun && p.id <= Body.Saturn)
        .map((planet) => {
            const vargaPositions = buildVargaPositions(planet.longitude, planets);
            const shadbala = calculateShadbala({
                planet,
                allPlanets: planets,
                houses: { ...houses, vertex: houses.vertex ?? 0 },
                sun,
                moon,
                timeDetails: { birthHour, sunrise, sunset },
                vargaPositions,
            });
            return {
                planetId: planet.id,
                planetName: planet.name,
                rupas: +(shadbala.total / 60).toFixed(4),
                virupas: +shadbala.total.toFixed(4),
                components: {
                    sthana: +shadbala.sthana.toFixed(4),
                    dig: +shadbala.dig.toFixed(4),
                    kaala: +shadbala.kaala.toFixed(4),
                    chesta: +shadbala.chesta.toFixed(4),
                    naisargika: +shadbala.naisargika.toFixed(4),
                    drig: +shadbala.drig.toFixed(4),
                },
                breakdown: {
                    uchcha: +shadbala.breakdown.uchcha.toFixed(4),
                    saptavargaja: +shadbala.breakdown.saptavargaja.toFixed(4),
                    kendra: +shadbala.breakdown.kendra.toFixed(4),
                    ojayugma: +shadbala.breakdown.ojayugma.toFixed(4),
                    natonata: +shadbala.breakdown.natonata.toFixed(4),
                    paksha: +shadbala.breakdown.paksha.toFixed(4),
                    tribhaga: +shadbala.breakdown.tribhaga.toFixed(4),
                    ayana: +shadbala.breakdown.ayana.toFixed(4),
                },
                ishtaPhala: +shadbala.ishtaPhala.toFixed(4),
                kashtaPhala: +shadbala.kashtaPhala.toFixed(4),
            };
        });
}
