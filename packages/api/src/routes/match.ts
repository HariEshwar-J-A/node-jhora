import { FastifyInstance } from 'fastify';
import { PoruthamMatch } from '@node-jhora/match';
import { getEngine } from '../server.js';
import { MatchInputSchema } from '../schemas/birth-input.js';
import { parseBirthInput } from '../schemas/helpers.js';

const NAKSHATRA_SPAN = 360 / 27;

function getMoonNakshatra(moonLon: number): { nakIdx: number; sign: number } {
    const nakIdx = Math.floor(moonLon / NAKSHATRA_SPAN);
    const sign   = Math.floor(moonLon / 30) + 1;
    return { nakIdx: nakIdx % 27, sign };
}

export async function matchRoutes(app: FastifyInstance): Promise<void> {
    app.post('/match', async (req, reply) => {
        const input = MatchInputSchema.parse(req.body);
        const engine = getEngine();

        const p1 = parseBirthInput(input.person1);
        const p2 = parseBirthInput(input.person2);

        const planets1 = engine.getPlanets(p1.dt, p1.location, { ayanamsaOrder: p1.ayanamsaOrder, nodeType: p1.nodeType });
        const planets2 = engine.getPlanets(p2.dt, p2.location, { ayanamsaOrder: p2.ayanamsaOrder, nodeType: p2.nodeType });

        const moon1 = planets1.find(p => p.id === 1)!;
        const moon2 = planets2.find(p => p.id === 1)!;

        const { nakIdx: nak1, sign: sign1 } = getMoonNakshatra(moon1.longitude);
        const { nakIdx: nak2, sign: sign2 } = getMoonNakshatra(moon2.longitude);

        // Convention: person1 = boy, person2 = girl (as per Porutham)
        const result = PoruthamMatch.match(nak1, nak2, sign1, sign2);

        return reply.status(200).send({
            person1MoonNakshatra: nak1 + 1, // 1-27
            person2MoonNakshatra: nak2 + 1,
            person1MoonSign:      sign1,
            person2MoonSign:      sign2,
            ...result,
        });
    });
}
