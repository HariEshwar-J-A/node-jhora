
import { PlanetPosition, normalize360 } from '@node-jhora/core';

export interface JaiminiKaraka {
    planetId: number;
    karaka: string; // AK, AmK, BK, MK, PK, GK, DK
    longitude: number;
}

export interface ArudhaPada {
    house: number; // 1-12
    sign: number; // 0-11
    arudhaSign: number; // 0-11
}

export class JaiminiCore {

    /**
     * Calculates the 7 Chara Karakas.
     * Rule: Sort 7 planets (Sun to Sat) by degrees (Sign is ignored).
     * Tie-break: Natural order (Sun > Moon > Mars > Mercury > Jupiter > Venus > Saturn).
     */
    public static calculateCharaKarakas(planets: PlanetPosition[]): JaiminiKaraka[] {
        // Filter out Rahu/Ketu/Uranus etc. Only Sun(0)..Sat(6).
        const candidates = planets.filter(p => p.id >= 0 && p.id <= 6);

        // Normalize to 0-30 degrees
        const data = candidates.map(p => {
            return {
                id: p.id,
                degInSign: p.longitude % 30,
                absoluteLon: p.longitude
            };
        });

        // Sort descending
        data.sort((a, b) => {
            const diff = b.degInSign - a.degInSign;
            if (Math.abs(diff) > 0.000001) return diff;
            
            // Tie-break: specific natural order
            // Sun(0), Mon(1), Mar(4), Mer(2), Jup(5), Ven(3), Sat(6)
            // Lets define strength map
            const strength: {[key: number]: number} = {
                0: 7, 1: 6, 4: 5, 2: 4, 5: 3, 3: 2, 6: 1
            };
            return strength[b.id] - strength[a.id];
        });

        const names = ['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK'];
        return data.map((p, i) => ({
            planetId: p.id,
            karaka: names[i] || 'None',
            longitude: p.absoluteLon
        }));
    }

    /**
     * Calculates Signs aspected by a given Sign (Jaimini Rashi Drishti).
     * Movable (1,4,7,10) -> Fixed (2,5,8,11) except adjacent.
     * Fixed -> Movable except adjacent.
     * Dual (3,6,9,12) -> Other Duals.
     * @param signIndex 0-based (0=Aries)
     */
    public static getRashiDrishti(signIndex: number): number[] {
        const sign = signIndex + 1; // 1-based for logic ease
        const type = (sign - 1) % 3; // 0=Movable, 1=Fixed, 2=Dual

        if (type === 2) {
            // Dual (3,6,9,12). Aspects other duals (3,6,9,12).
            return [2, 5, 8, 11].filter(s => s !== signIndex);
        }

        const aspected: number[] = [];
        if (type === 0) {
            // Movable (1,4,7,10) aspects Fixed (2,5,8,11)
            // Exception: Adjacent. 
            // Aries(1-Mov) aspects Leo(5), Scorp(8), Aqua(11). Skips Tau(2).
            // Cancer(4-Mov) aspects Sco(8), Aqu(11), Tau(2). Skips Leo(5).
            // Libra(7-Mov) aspects Aqu(11), Tau(2), Leo(5). Skips Sco(8).
            // Cap(10-Mov) aspects Tau(2), Leo(5), Sco(8). Skips Aqu(11).
            const fixed = [1, 4, 7, 10]; // Indices of fixed signs (Tau, Leo, Sc, Aq)
            // Wait: 0=Ari(Mov), 1=Tau(Fix), 2=Gem(Dual).
            // Movable Indices: 0, 3, 6, 9.
            // Fixed Indices: 1, 4, 7, 10.
            
            // Adjacent to Aries(0) is Taurus(1).
            // Adjacent to Cancer(3) is Leo(4).
            // ...
            // So adjacent is ALWAYS (signIndex + 1).
            const adjacent = (signIndex + 1) % 12;
            
            [1, 4, 7, 10].forEach(f => {
                if (f !== adjacent) aspected.push(f);
            });
        } else {
            // Fixed (1,4,7,10 indices) aspects Movable (0,3,6,9)
            // Exception: Adjacent BACKWARDS.
            // Taurus(1-Fix) aspects Can(3), Lib(6), Cap(9). Skips Ari(0).
            // Leo(4-Fix) aspects Lib(6), Cap(9), Ari(0). Skips Can(3).
            // Adjacent is (signIndex - 1).
            let adjacent = (signIndex - 1);
            if (adjacent < 0) adjacent += 12;

            [0, 3, 6, 9].forEach(m => {
                if (m !== adjacent) aspected.push(m);
            });
        }
        return aspected;
    }

    /**
     * Calculates Arudha Pada for a House.
     * @param houseNumber 1-12
     * @param lordSignIndex 0-11 (Where the lord is placed)
     * @param houseSignIndex 0-11 (Sign at house cusp)
     */
    public static calculateArudha(houseNumber: number, houseSignIndex: number, lordSignIndex: number): number {
        // Distance from House to Lord (inclusive vs count steps)
        // Standard: Count signs from House to Lord.
        // e.g. Ari(0) to Gem(2). Ari(1), Tau(2), Gem(3). Count = 3.
        // Or simple subtraction: (Lord - House) + 1.
        let dist = (lordSignIndex - houseSignIndex) + 1;
        if (dist <= 0) dist += 12;

        // Count same distance from Lord
        // Sign = (LordSign + (dist - 1)) % 12
        let arudhaIndex = (lordSignIndex + (dist - 1)) % 12;

        // Exceptions (Swastheeya)
        // Check relative position of Arudha from Original House
        // Arudha - House
        let finalDist = (arudhaIndex - houseSignIndex) + 1;
        if (finalDist <= 0) finalDist += 12;

        // If in same house (1st) -> Move to 10th
        if (finalDist === 1) {
            arudhaIndex = (arudhaIndex + 9) % 12; // +10th house = +9 signs
        }
        // If in 7th house -> Move to 10th (from 7th? i.e. 4th from House)
        // BPHS: "Yatra kutrapi hani syat..." - if pada falls in 1 or 7, it is destroyed/loss.
        // Rule: If 1st, make it 10th. If 7th, make it 10th from 7th = 4th from House.
        else if (finalDist === 7) {
            arudhaIndex = (arudhaIndex + 9) % 12; // 10th from where it fell.
        }

        return arudhaIndex;
    }
}
