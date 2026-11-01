// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { Body, calculatePanchanga } from '@node-jhora/core';
import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

import { attachResultEnvelope } from '../lib/result-envelope.js';
import { BirthInputSchema } from '../schemas/birth-input.js';
import { birthEphemerisOptions, parseBirthInput } from '../schemas/helpers.js';
import { getEngine } from '../server.js';

export async function panchangaRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/panchanga', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const parsed = parseBirthInput(req.body);
        const { dt, sunriseHour, settingsHash } = parsed;
        const engine = getEngine();

        const planets = engine.getPlanets(dt, parsed.location, birthEphemerisOptions(parsed));
        const sun = planets.find((p) => p.id === Body.Sun)!;
        const moon = planets.find((p) => p.id === Body.Moon)!;
        const panchanga = calculatePanchanga(sun.longitude, moon.longitude, dt, sunriseHour);

        return reply
            .status(200)
            .send(attachResultEnvelope({ ...panchanga, settingsHash }, { settingsHash }));
    });
}
