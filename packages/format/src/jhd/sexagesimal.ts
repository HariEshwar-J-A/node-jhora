// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Convert JHora `.jhd` packed values on lines 4–7 to decimal degrees or hours.
 *
 * JHora stores the integer degrees (or hours) in the whole part and **decimal
 * minutes ÷ 100** in the fractional part — not `HH.MMSS`. Example:
 * `74.002160` → 74° + 0.216′ = 74°00′12.96″, not 74°00′36″.
 */
export function sexagesimalToDecimal(packed: number): number {
    const sign = packed < 0 ? -1 : 1;
    const abs = Math.abs(packed);
    const whole = Math.floor(abs);
    const frac = abs - whole;
    const minutesDecimal = frac * 100;
    return sign * (whole + minutesDecimal / 60);
}

/**
 * Inverse of {@link sexagesimalToDecimal}: whole degrees/hours plus fractional
 * minutes ÷ 100 (JHora `.jhd` wire format).
 */
export function decimalToSexagesimal(decimal: number, fractionalDigits = 8): string {
    const negative = decimal < 0;
    const abs = Math.abs(decimal);
    const whole = Math.floor(abs);
    const minutesDecimal = (abs - whole) * 60;
    const minOver100 = minutesDecimal / 100;
    const fracTail = minOver100.toFixed(fractionalDigits).slice(2).replace(/0+$/, '');
    const unsigned = fracTail ? `${whole}.${fracTail}` : String(whole);
    return negative && (whole !== 0 || fracTail !== '') ? `-${unsigned}` : unsigned;
}

export function flipSignPacked(packed: number): number {
    return packed === 0 ? 0 : -packed;
}
