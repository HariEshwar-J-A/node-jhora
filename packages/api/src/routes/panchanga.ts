import { Body, calculatePanchanga } from '@node-jhora/core';
import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

import { attachResultEnvelope } from '../lib/result-envelope.js';
import { BirthInputSchema } from '../schemas/birth-input.js';
import { parseBirthInput } from '../schemas/helpers.js';
import { getEngine } from '../server.js';

export async function panchangaRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/panchanga', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const {
            dt,
            location,
            ayanamsaOrder,
            nodeType,
            positionMode,
            topocentric,
            ayanamsaOffset,
            sunriseHour,
            settingsHash,
        } = parseBirthInput(req.body);
        const engine = getEngine();

        const planets = engine.getPlanets(dt, location, {
            ayanamsaOrder,
            nodeType,
            positionMode,
            topocentric,
            ayanamsaOffset,
        });
        const sun = planets.find((p) => p.id === Body.Sun)!;
        const moon = planets.find((p) => p.id === Body.Moon)!;
        const panchanga = calculatePanchanga(sun.longitude, moon.longitude, dt, sunriseHour);

        return reply
            .status(200)
            .send(attachResultEnvelope({ ...panchanga, settingsHash }, { settingsHash }));
    });
}
