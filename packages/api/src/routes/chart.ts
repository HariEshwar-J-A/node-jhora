import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { calculateVarga } from '@node-jhora/core';
import { ChartSession } from '@node-jhora/engine';
import { getEngine } from '../server.js';
import { BirthInputSchema } from '../schemas/birth-input.js';
import { parseBirthInput } from '../schemas/helpers.js';
import { attachResultEnvelope } from '../lib/result-envelope.js';

export async function chartRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    // POST /v1/chart — full birth chart (planets, houses, panchanga)
    typed.post('/chart', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const parsed = parseBirthInput(req.body);
        const { dt, location, ayanamsaOrder, houseSystem, settingsHash, settings } = parsed;
        const engine = getEngine();

        const session = new ChartSession({
            instant: dt,
            location,
            settings,
            ephemeris: engine,
            houseSystemOverride: houseSystem,
        });
        const planets = session.getPlanets();
        const housesResult = session.getHouses();
        const panchanga = session.getPanchanga();
        const ayanamsa = engine.getAyanamsa(engine.julday(dt), ayanamsaOrder);

        return reply.status(200).send(attachResultEnvelope({
            planets,
            houses: {
                system:    houseSystem,
                ascendant: housesResult.ascendant,
                mc:        housesResult.mc,
                cusps:     housesResult.cusps,
            },
            panchanga,
            settingsHash,
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
        }, { settingsHash }));
    });

    // POST /v1/chart/vargas — all 16 divisional charts
    typed.post('/chart/vargas', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const { dt, location, ayanamsaOrder, nodeType, dasamsaScheme, horaScheme, positionMode, topocentric, ayanamsaOffset, settingsHash } = parseBirthInput(req.body);
        const engine = getEngine();

        const planets = engine.getPlanets(dt, location, { ayanamsaOrder, nodeType, positionMode, topocentric, ayanamsaOffset });
        const DIVISIONS = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60];

        const vargas: Record<string, any[]> = {};
        for (const d of DIVISIONS) {
            vargas[`D${d}`] = planets.map(p => {
                const v = calculateVarga(p.longitude, d, { dasamsaScheme, horaScheme });
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

        return reply.status(200).send(attachResultEnvelope({ vargas, settingsHash }, { settingsHash }));
    });
}
