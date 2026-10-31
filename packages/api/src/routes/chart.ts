import { calculateVarga, vargaOptionsFromVariants } from '@node-jhora/core';
import { ChartSession } from '@node-jhora/engine';
import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

import { attachResultEnvelope } from '../lib/result-envelope.js';
import { BirthInputSchema } from '../schemas/birth-input.js';
import { birthEphemerisOptions, parseBirthInput } from '../schemas/helpers.js';
import { getEngine } from '../server.js';

export async function chartRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    // POST /v1/chart — full birth chart (planets, houses, panchanga)
    typed.post('/chart', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const parsed = parseBirthInput(req.body);
        const { dt, julianDayUt, location, ayanamsaOrder, houseSystem, settingsHash, settings } =
            parsed;
        const engine = getEngine();

        const session = new ChartSession({
            instant: dt,
            julianDayUt,
            location,
            settings,
            ephemeris: engine,
            houseSystemOverride: houseSystem,
        });
        const planets = session.getPlanets();
        const housesResult = session.getHouses();
        const panchanga = session.getPanchanga();
        const ayanamsa = engine.getAyanamsa(
            julianDayUt,
            ayanamsaOrder,
            parsed.ayanamsaOffset,
            undefined,
            {
                precisionProfile: settings.precisionProfile,
                deltaTOverrideSeconds: settings.deltaTOverrideSeconds,
            },
        );

        return reply.status(200).send(
            attachResultEnvelope(
                {
                    planets,
                    houses: {
                        system: houseSystem,
                        ascendant: housesResult.ascendant,
                        mc: housesResult.mc,
                        cusps: housesResult.cusps,
                    },
                    panchanga,
                    settingsHash,
                    meta: {
                        ayanamsaName: req.body.ayanamsa,
                        ayanamsaValue: ayanamsa,
                        nodeType: req.body.nodeType,
                        julianDay: julianDayUt,
                        ...(parsed.resolvedCity
                            ? {
                                  resolvedCity: parsed.resolvedCity,
                                  resolvedTimezone: parsed.resolvedTimezone,
                                  resolvedLat: location.latitude,
                                  resolvedLon: location.longitude,
                              }
                            : {}),
                    },
                },
                { settingsHash },
            ),
        );
    });

    // POST /v1/chart/vargas — all 16 divisional charts
    typed.post('/chart/vargas', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const parsed = parseBirthInput(req.body);
        const { dt, location, dasamsaScheme, horaScheme, settingsHash } = parsed;
        const engine = getEngine();

        const planets = engine.getPlanets(dt, location, birthEphemerisOptions(parsed));
        const DIVISIONS = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144,
            150,
        ];

        const vargas: Record<string, any[]> = {};
        for (const d of DIVISIONS) {
            vargas[`D${d}`] = planets.map((p) => {
                const v = calculateVarga(p.longitude, d, {
                    ...vargaOptionsFromVariants(parsed.settings.vargaVariants),
                    dasamsaScheme,
                    horaScheme,
                });
                return {
                    planetId: p.id,
                    planetName: p.name,
                    sign: v.sign,
                    degree: v.degree,
                    longitude: v.longitude,
                    ...(v.deity ? { deity: v.deity } : {}),
                };
            });
        }

        return reply
            .status(200)
            .send(attachResultEnvelope({ vargas, settingsHash }, { settingsHash }));
    });
}
