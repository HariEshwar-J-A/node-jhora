/**
 * KP System — Sub Lord Calculation
 *
 * The Krishnamurti Paddhati (KP) system divides each Nakshatra into
 * sub-divisions proportional to Vimshottari Dasha years. Sub-sub-lords
 * are similarly nested one level deeper.
 *
 * All arithmetic uses Decimal.js to avoid floating-point accumulation
 * errors at sub-lord boundaries.
 *
 * Planet ID mapping (Vimshottari Dasha order):
 *   Index: 0=Ketu, 1=Venus, 2=Sun, 3=Moon, 4=Mars, 5=Rahu, 6=Jupiter, 7=Saturn, 8=Mercury
 *   Actual planet IDs: [8, 3, 0, 1, 4, 7, 5, 6, 2]
 */

import { Decimal } from 'decimal.js';
import { normalize360D, D, toNum } from '../core/precise.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Vimshottari Dasha order (cycle of 9 lords)
const DASHA_LORD_IDS: number[] = [8, 3, 0, 1, 4, 7, 5, 6, 2];
// Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury

// Dasha years for each lord (same order)
const DASHA_YEARS: number[] = [7, 20, 6, 10, 7, 18, 16, 19, 17];

// Total Vimshottari cycle = 120 years
const TOTAL_YEARS = new Decimal(120);

// Nakshatra span = 360/27 = 40/3 degrees (exact rational)
const NAKSHATRA_SPAN = new Decimal(40).div(3);

// Sign rulers (0-indexed sign → planet ID)
// Aries=Mars(4), Taurus=Venus(3), Gemini=Mercury(2), Cancer=Moon(1), Leo=Sun(0),
// Virgo=Mercury(2), Libra=Venus(3), Scorpio=Mars(4), Sag=Jupiter(5),
// Cap=Saturn(6), Aquarius=Saturn(6), Pisces=Jupiter(5)
const SIGN_RULERS: number[] = [4, 3, 2, 1, 0, 2, 3, 4, 5, 6, 6, 5];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface KPSignificator {
    longitude:  number;
    signLord:   number; // planet ID
    starLord:   number; // planet ID
    subLord:    number; // planet ID
    subSubLord: number; // planet ID
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class KPSubLord {

    /**
     * Compute KP significators (Sign/Star/Sub/SubSub lords) for a given longitude.
     *
     * @param longitude  Ecliptic sidereal longitude [0, 360)
     * @returns KPSignificator with all four planet IDs
     */
    public static calculateKPSignificators(longitude: number): KPSignificator {
        const lon = normalize360D(new Decimal(longitude));

        // 1. Sign lord (12 signs of 30° each)
        const signIdx  = lon.div(30).floor().toNumber();        // 0-11
        const signLord = SIGN_RULERS[signIdx];

        // 2. Star lord (Nakshatra — 27 of 13.333...° each)
        const nakIdx   = lon.div(NAKSHATRA_SPAN).floor().toNumber() % 27; // 0-26
        const starLordVimIdx = nakIdx % 9;                       // 0-8 (Vimshottari cycle)
        const starLord       = DASHA_LORD_IDS[starLordVimIdx];

        // 3. Sub lord — position within Nakshatra
        const lonInNak  = lon.mod(NAKSHATRA_SPAN);              // 0 to 13.333...°
        const { subLord, subSubLord } = KPSubLord.findSubLords(lonInNak, starLordVimIdx);

        return { longitude: toNum(lon), signLord, starLord, subLord, subSubLord };
    }

    /**
     * Find Sub lord and Sub-Sub lord by iterating the Vimshottari sub-divisions.
     *
     * @param posInNak     Decimal position within the Nakshatra [0, NAKSHATRA_SPAN)
     * @param startVimIdx  0-8 index in DASHA_LORD_IDS where the sub-cycle begins
     */
    private static findSubLords(posInNak: Decimal, startVimIdx: number): { subLord: number; subSubLord: number } {
        let remaining = posInNak;
        let subLord    = -1;
        let subSubLord = -1;

        for (let i = 0; i < 9; i++) {
            const vimIdx   = (startVimIdx + i) % 9;
            const years    = DASHA_YEARS[vimIdx];
            const subSpan  = new Decimal(years).div(TOTAL_YEARS).times(NAKSHATRA_SPAN);

            if (remaining.lt(subSpan) || remaining.minus(subSpan).abs().lt(new Decimal('1e-10'))) {
                subLord = DASHA_LORD_IDS[vimIdx];

                // 4. Sub-Sub lord — iterate within the sub-span
                let sslRemaining = remaining;
                for (let j = 0; j < 9; j++) {
                    const sslVimIdx  = (vimIdx + j) % 9;
                    const sslYears   = DASHA_YEARS[sslVimIdx];
                    const sslSpan    = new Decimal(sslYears).div(TOTAL_YEARS).times(subSpan);

                    if (sslRemaining.lt(sslSpan) || sslRemaining.minus(sslSpan).abs().lt(new Decimal('1e-10'))) {
                        subSubLord = DASHA_LORD_IDS[sslVimIdx];
                        break;
                    }
                    sslRemaining = sslRemaining.minus(sslSpan);
                }
                break;
            }

            remaining = remaining.minus(subSpan);
        }

        return { subLord, subSubLord };
    }
}
