import { Body } from '@node-jhora/core';
import { PoruthamMatch } from '@node-jhora/match';
import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

import { attachResultEnvelope } from '../lib/result-envelope.js';
import { MatchInputSchema } from '../schemas/birth-input.js';
import { birthEphemerisOptions, parseBirthInput } from '../schemas/helpers.js';
import { getEngine } from '../server.js';

const NAKSHATRA_SPAN = 360 / 27;

function getMoonNakshatra(moonLon: number): { nakIdx: number; sign: number } {
    const nakIdx = Math.floor(moonLon / NAKSHATRA_SPAN);
    const sign = Math.floor(moonLon / 30) + 1;
    return { nakIdx: nakIdx % 27, sign };
}

export async function matchRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/match', { schema: { body: MatchInputSchema } }, async (req, reply) => {
        const engine = getEngine();

        const p1 = parseBirthInput(req.body.person1);
        const p2 = parseBirthInput(req.body.person2);

        const planets1 = engine.getPlanets(p1.dt, p1.location, birthEphemerisOptions(p1));
        const planets2 = engine.getPlanets(p2.dt, p2.location, birthEphemerisOptions(p2));

        const moon1 = planets1.find((p) => p.id === Body.Moon)!;
        const moon2 = planets2.find((p) => p.id === Body.Moon)!;

        const { nakIdx: nak1, sign: sign1 } = getMoonNakshatra(moon1.longitude);
        const { nakIdx: nak2, sign: sign2 } = getMoonNakshatra(moon2.longitude);

        // Convention: person1 = boy, person2 = girl (as per Porutham)
        const result = PoruthamMatch.match(nak1, nak2, sign1, sign2);

        const settingsHash = { person1: p1.settingsHash, person2: p2.settingsHash };
        return reply.status(200).send(
            attachResultEnvelope(
                {
                    person1MoonNakshatra: nak1 + 1, // 1-27
                    person2MoonNakshatra: nak2 + 1,
                    person1MoonSign: sign1,
                    person2MoonSign: sign2,
                    ...result,
                    settingsHash,
                },
                { settingsHash },
            ),
        );
    });
}
