
/**
 * Shashtyamsa (D60) Deities.
 * Source: BPHS
 */
const D60_DEITIES = [
    "Ghor", "Rakshas", "Dev", "Kuber", "Yaksh", "Kindar", "Bhrast", "Kulaghna", "Garal", "Vahni",
    "Maya", "Purishaka", "Apampati", "Marutwan", "Kaal", "Sarpa", "Amrit", "Indu", "Mridu", "Komal",
    "Heramba", "Brahma", "Vishnu", "Maheshwara", "Deva", "Ardra", "Kalinas", "Kshitish", "Kamalakar", "Gulika",
    "Mrityu", "Kaal", "Davagni", "Ghora", "Yama", "Kantaka", "Suddha", "Amrita", "Purnachandra", "Vishadagdha",
    "Kulanash", "Vamshakshaya", "Utpata", "Kaal", "Saumya", "Komal", "Sheetal", "Karaladamshtra", "Chandramukhi", "Praveen",
    "Kaalpavak", "Dhandayudha", "Nirmal", "Saumya", "Krura", "Atisheetal", "Amrika", "Payodhi", "Bhraman", "Chandrarekha"
];

// Note: Some texts reverse the order for Even signs.
// BPHS: "In Odd Rasis proceeding from 1... In Even Rasis reverse".

export class VargaDeities {

    /**
     * Gets the Shashtyamsa (D60) Deity.
     * @param longitude Planet Longitude
     */
    public static getD60Deity(longitude: number): string {
        const signIndex = Math.floor(longitude / 30); // 0-11
        const degreeInSign = longitude % 30;
        
        // Each part is 0.5 degrees (30 / 60)
        let part = Math.floor(degreeInSign / 0.5); // 0 to 59

        const isOdd = (signIndex + 1) % 2 !== 0;

        // If Even sign, reverse the order (according to standard practice in most softwares)
        // Part 0 (0-0.5) corresponds to Index 0 in Odd, Index 59 in Even?
        // Let's check authoritative source.
        // Yes, BPHS usually implies reversal for Adhomukha/Even signs for deities like this.
        if (!isOdd) {
            part = 59 - part;
        }

        return D60_DEITIES[part] || "Unknown";
    }
}
