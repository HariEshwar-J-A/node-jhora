import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
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
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/dasha', { schema: { body: DashaInputSchema } }, async (req, reply) => {
        const parsed = parseBirthInput(req.body);
        const { dt, location, ayanamsaOrder, nodeType, positionMode, topocentric, ayanamsaOffset, settingsHash, applyDasaYear, dashaYearDays } = parsed;
        const engine = getEngine();

        const planets = engine.getPlanets(dt, location, { ayanamsaOrder, nodeType, positionMode, topocentric, ayanamsaOffset });
        const moon    = planets.find(p => p.id === 1)!;

        const balance = calculateDashaBalance(moon.longitude);
        // The historical 365.256364-day year stays in force until the client
        // sends a preset, a settings object, or dasaYearDays.
        const periods = generateVimshottari(
            dt, moon.longitude, req.body.depth,
            applyDasaYear && dashaYearDays != null ? { yearDays: dashaYearDays } : undefined,
        );

        return reply.status(200).send({
            balance: {
                lord:              balance.lord,
                yearsRemaining:    balance.yearsRemaining,
                totalDuration:     balance.totalDuration,
                fractionTraversed: balance.fractionTraversed,
                nakshatraIndex:    balance.nakshatraIndex,
            },
            periods: periods.map(serializePeriod),
            settingsHash,
        });
    });
}
