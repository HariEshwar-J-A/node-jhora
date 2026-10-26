import { Body, KPSubLord } from '@node-jhora/core';
import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

import { attachResultEnvelope } from '../lib/result-envelope.js';
import { BirthInputSchema } from '../schemas/birth-input.js';
import { birthEphemerisOptions, parseBirthInput } from '../schemas/helpers.js';
import { getEngine } from '../server.js';

const PLANET_NAMES: Record<number, string> = {
    [Body.Sun]: 'Sun',
    [Body.Moon]: 'Moon',
    [Body.Mercury]: 'Mercury',
    [Body.Venus]: 'Venus',
    [Body.Mars]: 'Mars',
    [Body.Jupiter]: 'Jupiter',
    [Body.Saturn]: 'Saturn',
    7: 'Rahu',
    8: 'Ketu',
};

export async function kpRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/kp/significators', { schema: { body: BirthInputSchema } }, async (req, reply) => {
        const parsed = parseBirthInput(req.body);
        const { dt, settingsHash } = parsed;
        const engine = getEngine();

        const planets = engine.getPlanets(dt, parsed.location, birthEphemerisOptions(parsed));

        const significators = planets.map((p) => {
            const kp = KPSubLord.calculateKPSignificators(p.longitude);
            return {
                planetId: p.id,
                planetName: p.name,
                longitude: p.longitude,
                signLord: { id: kp.signLord, name: PLANET_NAMES[kp.signLord] ?? 'Unknown' },
                starLord: { id: kp.starLord, name: PLANET_NAMES[kp.starLord] ?? 'Unknown' },
                subLord: { id: kp.subLord, name: PLANET_NAMES[kp.subLord] ?? 'Unknown' },
                subSubLord: { id: kp.subSubLord, name: PLANET_NAMES[kp.subSubLord] ?? 'Unknown' },
            };
        });

        return reply
            .status(200)
            .send(attachResultEnvelope({ significators, settingsHash }, { settingsHash }));
    });
}
