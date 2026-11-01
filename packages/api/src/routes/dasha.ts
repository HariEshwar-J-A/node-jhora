// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { Body } from '@node-jhora/core';
import { calculateDashaBalance, generateVimshottari } from '@node-jhora/prediction';
import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

import { attachResultEnvelope } from '../lib/result-envelope.js';
import { DashaInputSchema } from '../schemas/birth-input.js';
import { birthEphemerisOptions, parseBirthInput } from '../schemas/helpers.js';
import { getEngine } from '../server.js';

/**
 * Serialize a DashaPeriod tree to a plain JSON-safe structure.
 * DateTime instances are converted to ISO strings; subPeriods recurse.
 */
function serializePeriod(p: any): any {
    return {
        planet: p.planet,
        level: p.level,
        start: p.start.toISO(),
        end: p.end.toISO(),
        durationYears: p.durationYears,
        subPeriods: p.subPeriods?.map(serializePeriod) ?? [],
    };
}

export async function dashaRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/dasha', { schema: { body: DashaInputSchema } }, async (req, reply) => {
        const parsed = parseBirthInput(req.body);
        const { dt, settingsHash, applyDasaYear, dashaYearDays } = parsed;
        const engine = getEngine();

        const planets = engine.getPlanets(dt, parsed.location, birthEphemerisOptions(parsed));
        const moon = planets.find((p) => p.id === Body.Moon)!;

        const balance = calculateDashaBalance(moon.longitude);
        // The historical 365.256364-day year stays in force until the client
        // sends a preset, a settings object, or dasaYearDays.
        const periods = generateVimshottari(
            dt,
            moon.longitude,
            req.body.depth,
            applyDasaYear && dashaYearDays != null ? { yearDays: dashaYearDays } : undefined,
        );

        return reply.status(200).send(
            attachResultEnvelope(
                {
                    balance: {
                        lord: balance.lord,
                        yearsRemaining: balance.yearsRemaining,
                        totalDuration: balance.totalDuration,
                        fractionTraversed: balance.fractionTraversed,
                        nakshatraIndex: balance.nakshatraIndex,
                    },
                    periods: periods.map(serializePeriod),
                    settingsHash,
                },
                { settingsHash },
            ),
        );
    });
}
