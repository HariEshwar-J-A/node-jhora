import { FastifyInstance } from 'fastify';
import { ZodTypeProvider }  from 'fastify-type-provider-zod';
import { DateTime }         from 'luxon';
import { z }                from 'zod';

import { EphemerisEngine, calculateHouseCusps } from '@node-jhora/core';
import { Ashtakavarga }                          from '@node-jhora/analytics';
import { TransitEngine }                         from '@node-jhora/prediction';

import { getEngine }        from '../server.js';
import { TransitInputSchema, type TransitInput } from '../schemas/birth-input.js';
import { parseBirthInput }  from '../schemas/helpers.js';

/**
 * Gochara: where the planets are *now*, relative to a natal chart.
 *
 * Answering "what should I expect?" needs the sky at the moment of asking, not
 * only the birth chart. Previously that required two `/v1/chart` calls and
 * manual house arithmetic on the client, which is exactly the kind of step that
 * gets skipped or done inconsistently.
 *
 * Everything here is measured against the **natal Moon** (the classical gochara
 * reference) and the **natal ascendant**, with Ashtakavarga bindus attached so a
 * transit can be weighted rather than merely noted.
 */


const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
               'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

/** Slow movers set the background; fast ones are noise beyond a few days. */
const SLOW_MOVERS = [5, 6];          // Jupiter, Saturn
const SLOW_NAMES: Record<number, string> = { 5: 'Jupiter', 6: 'Saturn' };

/** 1-based house distance from `fromSign` to `toSign`, both 1-based. */
const houseFrom = (fromSign: number, toSign: number): number =>
    (((toSign - fromSign) % 12) + 12) % 12 + 1;

export async function transitRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/transits', { schema: { body: TransitInputSchema } }, async (req, reply) => {
        const body = req.body as TransitInput;
        const { dt, location, ayanamsaOrder, nodeType, positionMode,
                topocentric, ayanamsaOffset, houseSystem } = parseBirthInput(body);
        const engine = getEngine();

        const asOf = body.asOf
            ? DateTime.fromISO(body.asOf).setZone(dt.zone)
            : DateTime.now().setZone(dt.zone);

        const opts = { ayanamsaOrder, nodeType, positionMode, topocentric, ayanamsaOffset };

        // ── Natal ───────────────────────────────────────────────────────────
        const natal      = engine.getPlanets(dt, location, opts);
        const natalHouse = calculateHouseCusps(dt, location.latitude, location.longitude,
                                               houseSystem as any, engine, ayanamsaOrder, ayanamsaOffset);
        const natalAscSign  = Math.floor(natalHouse.ascendant / 30) + 1;
        const natalMoon     = natal.find(p => p.name === 'Moon')!;
        const natalMoonSign = Math.floor(natalMoon.longitude / 30) + 1;

        // calculateSAV indexes signs 0-11 (Aries..Pisces), independent of the ascendant.
        const sav = Ashtakavarga.calculateSAV(natal).sav;

        // ── Transiting ──────────────────────────────────────────────────────
        const transiting = engine.getPlanets(asOf, location, opts);

        const planets = transiting.map(p => {
            const sign = Math.floor(p.longitude / 30) + 1;
            const natalCounterpart = natal.find(n => n.name === p.name)!;
            return {
                name:          p.name,
                sign,
                signName:      SIGNS[sign - 1],
                degree:        p.longitude % 30,
                longitude:     p.longitude,
                retrograde:    p.speed < 0,
                speed:         p.speed,
                houseFromMoon: houseFrom(natalMoonSign, sign),
                houseFromLagna: houseFrom(natalAscSign, sign),
                // Ashtakavarga strength of the sign being transited. Below ~25
                // bindus a transit tends to disappoint regardless of its nature.
                savBindus:     sav[sign - 1],
                natalSign:     Math.floor(natalCounterpart.longitude / 30) + 1,
                // A planet returning to its natal sign is its own recurrence cycle.
                isReturn:      sign === Math.floor(natalCounterpart.longitude / 30) + 1,
            };
        });

        // ── Sade Sati ───────────────────────────────────────────────────────
        // Saturn transiting the 12th, 1st or 2nd from the natal Moon. Derived
        // here rather than left to the caller, because getting it wrong is easy
        // and it materially changes a reading.
        const saturn = planets.find(p => p.name === 'Saturn')!;
        const satFromMoon = saturn.houseFromMoon;
        const sadeSati = {
            active: [12, 1, 2].includes(satFromMoon),
            phase:  satFromMoon === 12 ? 'rising'  :
                    satFromMoon === 1  ? 'peak'    :
                    satFromMoon === 2  ? 'setting' : null,
            houseFromMoon: satFromMoon,
            // Kantaka / Ashtama Shani are separate afflictions from the same body.
            kantakaShani: [4, 7, 10].includes(satFromMoon),
            ashtamaShani: satFromMoon === 8,
        };

        // ── Upcoming ingresses for the slow movers ──────────────────────────
        // Same zodiac and conventions as the chart these transits are read against.
        const te  = new TransitEngine(engine as EphemerisEngine, {
            ayanamsaOrder, positionMode, nodeType,
        });
        const end = asOf.plus({ days: body.horizonDays });

        const upcoming: Array<Record<string, unknown>> = [];
        for (const id of SLOW_MOVERS) {
            const events = await te.findTransits(id, asOf, end, 24);
            for (const e of events.filter(ev => ev.type === 'Sign')) {
                upcoming.push({
                    planet:   SLOW_NAMES[id],
                    from:     SIGNS[e.prevValue],
                    to:       SIGNS[e.newValue],
                    at:       e.time.toISO(),
                    houseFromMoon:  houseFrom(natalMoonSign, e.newValue + 1),
                    houseFromLagna: houseFrom(natalAscSign,  e.newValue + 1),
                });
            }
        }
        upcoming.sort((a, b) => String(a.at).localeCompare(String(b.at)));

        return reply.status(200).send({
            asOf: asOf.toISO(),
            natal: {
                ascendantSign: natalAscSign,
                ascendantSignName: SIGNS[natalAscSign - 1],
                moonSign: natalMoonSign,
                moonSignName: SIGNS[natalMoonSign - 1],
            },
            planets,
            sadeSati,
            upcoming,
            savBySign: sav,
            meta: {
                ayanamsaName:  body.ayanamsa,
                ayanamsaValue: engine.getAyanamsa(engine.julday(asOf), ayanamsaOrder),
                positionMode:  body.positionMode,
                nodeType:      body.nodeType,
                note: 'Houses are counted from the natal Moon (classical gochara reference) '
                    + 'and from the natal ascendant. savBindus is the Ashtakavarga strength '
                    + 'of the transited sign.',
            },
        });
    });
}
