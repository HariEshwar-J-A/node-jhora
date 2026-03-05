import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { calculatePanchanga } from '@node-jhora/core';
import { getEngine } from '../server.js';
import { BirthInputSchema } from '../schemas/birth-input.js';
import { parseBirthInput } from '../schemas/helpers.js';

export async function panchangaRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/panchanga', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const { dt, location, ayanamsaOrder, nodeType } = parseBirthInput(req.body);
        const engine = getEngine();

        const planets   = engine.getPlanets(dt, location, { ayanamsaOrder, nodeType });
        const sun       = planets.find(p => p.id === 0)!;
        const moon      = planets.find(p => p.id === 1)!;
        const panchanga = calculatePanchanga(sun.longitude, moon.longitude, dt);

        return reply.status(200).send(panchanga);
    });
}
