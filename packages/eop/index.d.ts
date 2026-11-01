export interface IersEopTable {
    mjdStart: number;
    count: number;
    ut1UtcMicros: Int32Array;
    xpMilliarcsec: Int16Array;
    ypMilliarcsec: Int16Array;
    finalsSha256: string;
    leapSha256: string;
}

export interface EopLookup {
    ut1MinusUtcSeconds: number;
    xpArcsec: number;
    ypArcsec: number;
    inTable: boolean;
}

export function parseEopBin(bytes: Buffer | Uint8Array): IersEopTable;
export function lookupEop(jdUt: number, table: IersEopTable): EopLookup;
export function mjdUtcFromJdUt(jdUt: number): number;
