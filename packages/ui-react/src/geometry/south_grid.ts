/**
 * Geometry for South Indian Chart (Fixed Sign Layout).
 * 12 Boxes arranged in a square border.
 * 
 * Grid 4x4.
 * Top Row: Pisces(11), Aries(0), Taurus(1), Gemini(2).
 * Right Col: Cancer(3), Leo(4).
 * Bot Row: Virgo(5), Libra(6), Scorpio(7), Sagittarius(8).
 * Left Col: Capricorn(9), Aquarius(10).
 * 
 * Centers are implicitly handled by the Grid logic, but we define coordinates here 
 * for consistency and flexible rendering (e.g. if we move to Path based later).
 */

export interface BoxCoordinate {
    x: number; // 0-3 Grid X
    y: number; // 0-3 Grid Y
}

export const SOUTH_GRID_MAP: Record<number, BoxCoordinate> = {
    11: {x: 0, y: 0}, // Pisces
    0:  {x: 1, y: 0}, // Aries
    1:  {x: 2, y: 0}, // Taurus
    2:  {x: 3, y: 0}, // Gemini
    3:  {x: 3, y: 1}, // Cancer
    4:  {x: 3, y: 2}, // Leo
    5:  {x: 3, y: 3}, // Virgo
    6:  {x: 2, y: 3}, // Libra
    7:  {x: 1, y: 3}, // Scorpio
    8:  {x: 0, y: 3}, // Sagittarius
    9:  {x: 0, y: 2}, // Capricorn
    10: {x: 0, y: 1}  // Aquarius
};
