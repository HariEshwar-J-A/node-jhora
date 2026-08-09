import { FastifyInstance } from 'fastify';
import { ZodTypeProvider }  from 'fastify-type-provider-zod';
import { DateTime }         from 'luxon';

import { EphemerisEngine, calculateHouseCusps, calculateVarga } from '@node-jhora/core';
import { Ashtakavarga }                                          from '@node-jhora/analytics';
import { generateVimshottari, TransitEngine }                    from '@node-jhora/prediction';

import { getEngine }        from '../server.js';
import { ReadingInputSchema, type ReadingInput } from '../schemas/birth-input.js';
import { parseBirthInput }  from '../schemas/helpers.js';

/**
 * One call returning everything an interpretation needs.
 *
 * `/v1/chart`, `/v1/dasha` and `/v1/transits` each answer part of "what should I
 * expect?", and a client stitching them together has to re-derive the same
 * relationships every time — usually the house distance from a sub-period lord
 * to the lord above it, which is the single most important number in the answer
 * and the easiest to get wrong.
 *
 * Classical dasha results are almost never unconditional. BPHS states them as
 * "…if the antardasha lord is in the 5th, 9th, 11th or 2nd from the dasha lord"
 * versus "…if in the 6th, 8th or 12th". Reading a verse without resolving that
 * condition is not interpretation. So this endpoint computes it and labels which
 * branch applies.
 *
 * Scope: **computation only.** No classical text, no LLM, no prose. Retrieval of
 * BPHS passages lives in JyotishBase, and the wording of a reading belongs to
 * whatever consumes this. That boundary keeps the engine self-contained.
 */

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
               'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

/** Sign lords, 1-based. */
const SIGN_LORD = [null, 'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
                   'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'] as const;

const EXALT: Record<string, number> = { Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7 };
const DEBIL: Record<string, number> = { Sun: 7, Moon: 8, Mars: 4, Mercury: 12, Jupiter: 10, Venus: 6, Saturn: 1 };
const OWN:   Record<string, number[]> = { Sun: [5], Moon: [4], Mars: [1, 8], Mercury: [3, 6],
                                          Jupiter: [9, 12], Venus: [2, 7], Saturn: [10, 11] };

/** Houses from a dasha lord in which a sub-lord is classically benefic / malefic. */
const FAVOURABLE_FROM_LORD = [1, 2, 4, 5, 7, 9, 10, 11];
const ADVERSE_FROM_LORD    = [6, 8, 12];

const signOf = (lon: number) => Math.floor(lon / 30) + 1;
const houseFrom = (from: number, to: number) => ((((to - from) % 12) + 12) % 12) + 1;

function dignityOf(name: string, sign: number): string {
    if (EXALT[name] === sign) return 'exalted';
    if (DEBIL[name] === sign) return 'debilitated';
    if ((OWN[name] ?? []).includes(sign)) return 'own sign';
    return 'neutral';
}

/** Which houses a planet rules for this ascendant — its functional nature. */
function lordshipsFor(planet: string, ascSign: number): number[] {
    const out: number[] = [];
    for (let s = 1; s <= 12; s++) {
        if (SIGN_LORD[s] === planet) out.push(houseFrom(ascSign, s));
    }
    return out;
}

export async function readingRoutes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/reading', { schema: { body: ReadingInputSchema } }, async (req, reply) => {
        const body = req.body as ReadingInput;
        const { dt, location, ayanamsaOrder, nodeType, positionMode,
                topocentric, ayanamsaOffset, houseSystem } = parseBirthInput(body);
        const engine: EphemerisEngine = getEngine();

        const asOf = body.asOf
            ? DateTime.fromISO(body.asOf).setZone(dt.zone)
            : DateTime.now().setZone(dt.zone);

        const opts = { ayanamsaOrder, nodeType, positionMode, topocentric, ayanamsaOffset };

        // ── Natal ───────────────────────────────────────────────────────────
        const natal  = engine.getPlanets(dt, location, opts);
        const houses = calculateHouseCusps(dt, location.latitude, location.longitude,
                                           houseSystem as any, engine, ayanamsaOrder, ayanamsaOffset);
        const ascSign  = signOf(houses.ascendant);
        const moonNatal = natal.find(p => p.name === 'Moon')!;
        const moonSign = signOf(moonNatal.longitude);
        const { sav }  = Ashtakavarga.calculateSAV(natal);

        const natalBy = new Map(natal.map(p => [p.name, p]));

        const describeNatal = (p: typeof natal[number]) => {
            const sign = signOf(p.longitude);
            return {
                name: p.name,
                sign, signName: SIGNS[sign - 1],
                degree: +(p.longitude % 30).toFixed(4),
                house: houseFrom(ascSign, sign),
                retrograde: p.speed < 0,
                dignity: dignityOf(p.name, sign),
                dispositor: SIGN_LORD[sign],
                rulesHouses: lordshipsFor(p.name, ascSign),
                navamsaSign: calculateVarga(p.longitude, 9).sign,
            };
        };

        // ── Dasha stack at `asOf`, to Pratyantar ────────────────────────────
        const tree = generateVimshottari(dt, moonNatal.longitude, body.depth);

        const stack: Array<Record<string, unknown>> = [];
        const transitions: Array<Record<string, unknown>> = [];
        let level: any[] = tree.filter((p: any) => p.level === 1);
        let parentLord: string | null = null;

        const LEVEL_NAME = ['', 'Mahadasha', 'Antardasha', 'Pratyantardasha',
                            'Sookshma', 'Prana'];

        while (level && level.length) {
            const idx = level.findIndex((p: any) =>
                asOf >= DateTime.fromISO(String(p.start)) && asOf < DateTime.fromISO(String(p.end)));
            if (idx < 0) break;
            const cur = level[idx];

            const lordNatal = natalBy.get(cur.planet);
            const lordSign  = lordNatal ? signOf(lordNatal.longitude) : null;

            // The hinge: where this lord sits relative to the lord above it.
            let fromParent: number | null = null;
            let branch: string | null = null;
            if (parentLord && lordSign) {
                const parentNatal = natalBy.get(parentLord);
                if (parentNatal) {
                    fromParent = houseFrom(signOf(parentNatal.longitude), lordSign);
                    branch = ADVERSE_FROM_LORD.includes(fromParent) ? 'adverse'
                           : FAVOURABLE_FROM_LORD.includes(fromParent) ? 'favourable'
                           : 'mixed';
                }
            }

            stack.push({
                level: cur.level,
                levelName: LEVEL_NAME[cur.level] ?? `L${cur.level}`,
                lord: cur.planet,
                start: cur.start,
                end: cur.end,
                yearsRemaining: +DateTime.fromISO(String(cur.end)).diff(asOf, 'years').years.toFixed(4),
                lordNatal: lordNatal ? describeNatal(lordNatal) : null,
                // Null at Mahadasha, which has no lord above it.
                houseFromLordAbove: fromParent,
                classicalBranch: branch,
            });

            const next = level[idx + 1];
            transitions.push({
                level: cur.level,
                levelName: LEVEL_NAME[cur.level] ?? `L${cur.level}`,
                endsAt: cur.end,
                nextLord: next ? next.planet : null,
                // When a level ends exactly with the one above it, the whole
                // cycle hands over rather than a sub-period rolling on.
                handsOverToParent: !next,
            });

            parentLord = cur.planet;
            level = cur.subPeriods ?? [];
        }

        // ── Transits at `asOf` ──────────────────────────────────────────────
        const transiting = engine.getPlanets(asOf, location, opts);
        const transitPlanets = transiting.map(p => {
            const sign = signOf(p.longitude);
            return {
                name: p.name,
                sign, signName: SIGNS[sign - 1],
                degree: +(p.longitude % 30).toFixed(4),
                retrograde: p.speed < 0,
                houseFromMoon: houseFrom(moonSign, sign),
                houseFromLagna: houseFrom(ascSign, sign),
                savBindus: sav[sign - 1],
                isReturn: sign === signOf(natalBy.get(p.name)!.longitude),
                // Flagged because a transit over a dasha lord is the most
                // informative gochara fact available.
                isDashaLord: stack.some(s => s.lord === p.name),
            };
        });

        const satFromMoon = transitPlanets.find(p => p.name === 'Saturn')!.houseFromMoon;

        const te = new TransitEngine(engine, { ayanamsaOrder, positionMode, nodeType });
        const upcoming: Array<Record<string, unknown>> = [];
        for (const [id, name] of [[5, 'Jupiter'], [6, 'Saturn']] as const) {
            for (const e of await te.findTransits(id, asOf, asOf.plus({ days: body.horizonDays }), 24)) {
                if (e.type !== 'Sign') continue;
                upcoming.push({
                    planet: name, from: SIGNS[e.prevValue], to: SIGNS[e.newValue],
                    at: e.time.toISO(),
                    houseFromMoon: houseFrom(moonSign, e.newValue + 1),
                    houseFromLagna: houseFrom(ascSign, e.newValue + 1),
                });
            }
        }
        upcoming.sort((a, b) => String(a.at).localeCompare(String(b.at)));

        return reply.status(200).send({
            asOf: asOf.toISO(),
            meta: {
                ayanamsa: body.ayanamsa,
                ayanamsaValue: engine.getAyanamsa(engine.julday(dt), ayanamsaOrder),
                positionMode: body.positionMode,
                nodeType: body.nodeType,
                houseSystem: body.houseSystem,
                engine: 'node-jhora / JPL DE440',
                scope: 'computation only — no classical text or interpretation',
            },
            natal: {
                ascendant: {
                    sign: ascSign, signName: SIGNS[ascSign - 1],
                    degree: +(houses.ascendant % 30).toFixed(4),
                    lord: SIGN_LORD[ascSign],
                },
                moonSign, moonSignName: SIGNS[moonSign - 1],
                planets: natal.map(describeNatal),
                savBySign: sav.map((bindus, i) => ({
                    sign: i + 1, signName: SIGNS[i], bindus, house: houseFrom(ascSign, i + 1),
                })),
            },
            dashaStack: stack,
            transitions,
            transits: {
                planets: transitPlanets,
                sadeSati: {
                    active: [12, 1, 2].includes(satFromMoon),
                    phase: satFromMoon === 12 ? 'rising'
                         : satFromMoon === 1  ? 'peak'
                         : satFromMoon === 2  ? 'setting' : null,
                    houseFromMoon: satFromMoon,
                    kantakaShani: [4, 7, 10].includes(satFromMoon),
                    ashtamaShani: satFromMoon === 8,
                },
                upcoming,
            },
            guidance: {
                classicalRule: 'Dasha promises, transit delivers, the natal chart decides '
                             + 'whether anything was on offer. A transit cannot deliver what '
                             + 'the chart and dasha do not support.',
                readingOrder: ['natal promise', 'mahadasha', 'antardasha',
                               'pratyantardasha', 'transit', 'ashtakavarga'],
                note: 'houseFromLordAbove selects which conditional branch of a classical '
                    + 'dasha verse applies; classicalBranch names it. savBindus below ~25 '
                    + 'weakens a transit regardless of its nature.',
            },
        });
    });
}
