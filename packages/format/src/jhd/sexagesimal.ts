// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Convert packed DD.MM / HH.MMSS values to decimal degrees or hours.
 *
 * `19.38` → 19 + 38/60; `-5.30` → -(5 + 30/60). Reading packed values as plain
 * decimals shifts the ascendant by several degrees while planets still look fine.
 */
export function sexagesimalToDecimal(packed: number): number {
    const sign = packed < 0 ? -1 : 1;
    const abs = Math.abs(packed);

    const whole = Math.floor(abs);
    const frac = abs - whole;

    const minutes = Math.floor(frac * 100 + 1e-9);
    const seconds = (frac * 100 - minutes) * 100;

    return sign * (whole + minutes / 60 + seconds / 3600);
}

/**
 * Inverse of {@link sexagesimalToDecimal}: `HH.MMSS` plus up to `secondDecimals`
 * fractional-second digits. Rounds total seconds first so 59.99… s carries into
 * the next minute instead of printing `60`.
 */
export function decimalToSexagesimal(decimal: number, secondDecimals = 2): string {
    const negative = decimal < 0;
    const scale = 10 ** secondDecimals;
    const totalUnits = Math.round(Math.abs(decimal) * 3600 * scale);
    const unitsPerMinute = 60 * scale;
    const unitsPerWhole = 60 * unitsPerMinute;
    const whole = Math.floor(totalUnits / unitsPerWhole);
    const minutes = Math.floor((totalUnits % unitsPerWhole) / unitsPerMinute);
    const secUnits = totalUnits % unitsPerMinute;
    const secWhole = Math.floor(secUnits / scale);
    const secFrac = secUnits % scale;

    let digits = String(minutes).padStart(2, '0') + String(secWhole).padStart(2, '0');
    if (secondDecimals > 0) digits += String(secFrac).padStart(secondDecimals, '0');
    digits = digits.replace(/0+$/, '');
    const body = digits ? `${whole}.${digits}` : String(whole);
    return negative && totalUnits !== 0 ? `-${body}` : body;
}

export function flipSignPacked(packed: number): number {
    return packed === 0 ? 0 : -packed;
}
