import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { calculateHouseCusps, calculatePanchanga, calculateVarga } from '@node-jhora/core';
import { getEngine } from '../server.js';
import { BirthInputSchema } from '../schemas/birth-input.js';
import { parseBirthInput } from '../schemas/helpers.js';

export async function chartRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    // POST /v1/chart — full birth chart (planets, houses, panchanga)
    typed.post('/chart', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const parsed = parseBirthInput(req.body);
        const { dt, location, ayanamsaOrder, nodeType, houseSystem } = parsed;
        const engine = getEngine();

        const planets = engine.getPlanets(dt, location, { ayanamsaOrder, nodeType });
        const housesResult = calculateHouseCusps(dt, location.latitude, location.longitude, houseSystem as any, engine);
        const ayanamsa = engine.getAyanamsa(engine.julday(dt));

        const sun  = planets.find(p => p.id === 0)!;
        const moon = planets.find(p => p.id === 1)!;
        const panchanga = calculatePanchanga(sun.longitude, moon.longitude, dt);

        return reply.status(200).send({
            planets: planets.map(p => ({
                id:          p.id,
                name:        p.name,
                longitude:   p.longitude,
                latitude:    p.latitude,
                speed:       p.speed,
                distance:    p.distance,
                declination: p.declination,
                sign:        Math.floor(p.longitude / 30) + 1,
                degree:      p.longitude % 30,
            })),
            houses: {
                system:    houseSystem,
                ascendant: housesResult.ascendant,
                mc:        housesResult.mc,
                cusps:     housesResult.cusps,
            },
            panchanga,
            meta: {
                ayanamsaName:  req.body.ayanamsa,
                ayanamsaValue: ayanamsa,
                nodeType:      req.body.nodeType,
                julianDay:     engine.julday(dt),
                ...(parsed.resolvedCity ? {
                    resolvedCity:     parsed.resolvedCity,
                    resolvedTimezone: parsed.resolvedTimezone,
                    resolvedLat:      location.latitude,
                    resolvedLon:      location.longitude,
                } : {}),
            },
        });
    });

    // POST /v1/chart/vargas — all 16 divisional charts
    typed.post('/chart/vargas', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const { dt, location, ayanamsaOrder, nodeType } = parseBirthInput(req.body);
        const engine = getEngine();

        const planets = engine.getPlanets(dt, location, { ayanamsaOrder, nodeType });
        const DIVISIONS = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60];

        const vargas: Record<string, any[]> = {};
        for (const d of DIVISIONS) {
            vargas[`D${d}`] = planets.map(p => {
                const v = calculateVarga(p.longitude, d);
                return {
                    planetId:   p.id,
                    planetName: p.name,
                    sign:       v.sign,
                    degree:     v.degree,
                    longitude:  v.longitude,
                    ...(v.deity ? { deity: v.deity } : {}),
                };
            });
        }

        return reply.status(200).send({ vargas });
    });
}
