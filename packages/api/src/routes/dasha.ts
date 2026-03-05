import { FastifyInstance } from 'fastify';
import { generateVimshottari, calculateDashaBalance } from '@node-jhora/prediction';
import { getEngine } from '../server.js';
import { DashaInputSchema } from '../schemas/birth-input.js';
import { parseBirthInput } from '../schemas/helpers.js';

/**
 * Serialize a DashaPeriod tree to a plain JSON-safe structure.
 * DateTime instances are converted to ISO strings; subPeriods recurse.
 */
function serializePeriod(p: any): any {
    return {
        planet:        p.planet,
        level:         p.level,
        start:         p.start.toISO(),
        end:           p.end.toISO(),
        durationYears: p.durationYears,
        subPeriods:    p.subPeriods?.map(serializePeriod) ?? [],
    };
}

export async function dashaRoutes(app: FastifyInstance): Promise<void> {
    app.post('/dasha', async (req, reply) => {
        const input = DashaInputSchema.parse(req.body);
        const { dt, location, ayanamsaOrder, nodeType } = parseBirthInput(input);
        const engine = getEngine();

        const planets = engine.getPlanets(dt, location, { ayanamsaOrder, nodeType });
        const moon    = planets.find(p => p.id === 1)!;

        const balance = calculateDashaBalance(moon.longitude);
        const periods = generateVimshottari(dt, moon.longitude, input.depth);

        return reply.status(200).send({
            balance: {
                lord:              balance.lord,
                yearsRemaining:    balance.yearsRemaining,
                totalDuration:     balance.totalDuration,
                fractionTraversed: balance.fractionTraversed,
                nakshatraIndex:    balance.nakshatraIndex,
            },
            periods: periods.map(serializePeriod),
        });
    });
}
