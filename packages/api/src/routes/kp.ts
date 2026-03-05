import { FastifyInstance } from 'fastify';
import { KPSubLord } from '@node-jhora/core';
import { getEngine } from '../server.js';
import { BirthInputSchema } from '../schemas/birth-input.js';
import { parseBirthInput } from '../schemas/helpers.js';

const PLANET_NAMES: Record<number, string> = {
    0: 'Sun', 1: 'Moon', 2: 'Mercury', 3: 'Venus', 4: 'Mars',
    5: 'Jupiter', 6: 'Saturn', 7: 'Rahu', 8: 'Ketu',
};

export async function kpRoutes(app: FastifyInstance): Promise<void> {
    app.post('/kp/significators', async (req, reply) => {
        const input = BirthInputSchema.parse(req.body);
        const { dt, location, ayanamsaOrder, nodeType } = parseBirthInput(input);
        const engine = getEngine();

        const planets = engine.getPlanets(dt, location, { ayanamsaOrder, nodeType });

        const significators = planets.map(p => {
            const kp = KPSubLord.calculateKPSignificators(p.longitude);
            return {
                planetId:     p.id,
                planetName:   p.name,
                longitude:    p.longitude,
                signLord:     { id: kp.signLord,   name: PLANET_NAMES[kp.signLord]   ?? 'Unknown' },
                starLord:     { id: kp.starLord,   name: PLANET_NAMES[kp.starLord]   ?? 'Unknown' },
                subLord:      { id: kp.subLord,    name: PLANET_NAMES[kp.subLord]    ?? 'Unknown' },
                subSubLord:   { id: kp.subSubLord, name: PLANET_NAMES[kp.subSubLord] ?? 'Unknown' },
            };
        });

        return reply.status(200).send({ significators });
    });
}
