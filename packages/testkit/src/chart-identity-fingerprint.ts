import { hashCanonicalSerialize } from './canonical-serialize.js';
import { sha256Utf8 } from './sha256.js';

/** IEEE-754 double little-endian hex (matches server-grade plan fingerprints). */
export function f64Hex(value: number): string {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface PlanetFingerprintInput {
    longitude: number;
    latitude: number;
    speed: number;
    name: string;
}

export interface HousesFingerprintInput {
    ascendant: number;
    mc: number;
    cusps: readonly number[];
}

/** Ordered planet f64 triples (stable name order). */
export function planetsFingerprintHex(planets: readonly PlanetFingerprintInput[]): string {
    const sorted = [...planets].sort((a, b) => a.name.localeCompare(b.name));
    return sorted
        .map((p) => `${p.name}:${f64Hex(p.longitude)}:${f64Hex(p.latitude)}:${f64Hex(p.speed)}`)
        .join('|');
}

export function housesFingerprintHex(houses: HousesFingerprintInput): string {
    const cuspPart = houses.cusps.map((c) => f64Hex(c)).join(',');
    return `${f64Hex(houses.ascendant)}:${f64Hex(houses.mc)}:${cuspPart}`;
}

/** SHA-256 of canonical JSON for the dasha section (period tree only). */
export function dashaTreeSha256(dasha: unknown): string {
    return hashCanonicalSerialize(dasha);
}

export function combinedBenchFingerprint(parts: {
    ayanamsaHex: string;
    planetsHex: string;
    housesHex: string;
    dashaSha256: string;
}): string {
    return sha256Utf8(
        `${parts.ayanamsaHex}\n${parts.planetsHex}\n${parts.housesHex}\n${parts.dashaSha256}`,
    );
}
