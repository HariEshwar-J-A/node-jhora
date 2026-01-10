import React from 'react';
import { PlanetPosition, HouseData } from '@node-jhora/core';
// Export imported components
export { AnimatedSouthIndianChart } from './AnimatedSouthIndianChart.js'; 
export { PortalTooltip } from './PortalTooltip.js';

export interface ChartProps {
  planets: PlanetPosition[];
  ascendant: number; // Sign Index (0-11) or Longitude? Usually Longitude. 
  // We need to determine the Ascendant Sign Index (0=Aries).
  // Our core module returns house cusps, etc. 
  // Let's assume input 'ascendant' is the degree, we'll calc sign.
  // OR standard approach: pass parsed data.
  // Let's stick to Node-Jhora types.
  
  width?: number;
  height?: number;
  className?: string;
  onHouseClick?: (signIndex: number) => void;
  onPlanetClick?: (planet: PlanetPosition) => void;
  style?: React.CSSProperties;
}

// Helper: Signs
const SIGNS = [
  'Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sa', 'Cp', 'Aq', 'Pi'
];

/**
 * South Indian Chart (The Box Style)
 * Layout: 12 Fixed Boxes.
 * Row 1 (L->R): Pis, Ari, Tau, Gem
 * Row 2 (L->R): Aqu, (Blank), (Blank), Can
 * Row 3 (L->R): Cap, (Blank), (Blank), Leo
 * Row 4 (L->R): Sag, Sco, Lib, Vir
 * Wait, standard South Indian layout:
 * Top Row (L->R): Pisces, Aries, Taurus, Gemini
 * Right Col (T->B): Gemini, Cancer, Leo, Virgo
 * Bottom Row (R->L): Virgo, Libra, Scorpio, Sagittarius
 * Left Col (B->T): Sagittarius, Capricorn, Aquarius, Pisces
 * Corner boxes are shared? No.
 * It's a 4x4 Grid mostly, with Center Empty.
 * Top: 0,0(Pi), 1,0(Ar), 2,0(Ta), 3,0(Ge) -> Wait.
 * Standard Clockwise from Top-Left?
 * Top-Left: Pisces? NO.
 * Standard South Indian:
 * Top-Left Box: Pisces. Then clockwise:
 * (0,0) Pisces
 * (1,0) Aries
 * (2,0) Taurus
 * (3,0) Gemini
 * (3,1) Cancer
 * (3,2) Leo
 * (3,3) Virgo
 * (2,3) Libra
 * (1,3) Scorpio
 * (0,3) Sagittarius
 * (0,2) Capricorn
 * (0,1) Aquarius
 * 
 * Coordinates (x,y) 0-3.
 */
const SOUTH_MAP: Record<number, {x: number, y: number}> = {
  11: {x: 0, y: 0}, // Pis
  0:  {x: 1, y: 0}, // Ari
  1:  {x: 2, y: 0}, // Tau
  2:  {x: 3, y: 0}, // Gem
  3:  {x: 3, y: 1}, // Can
  4:  {x: 3, y: 2}, // Leo
  5:  {x: 3, y: 3}, // Vir
  6:  {x: 2, y: 3}, // Lib
  7:  {x: 1, y: 3}, // Sco
  8:  {x: 0, y: 3}, // Sag
  9:  {x: 0, y: 2}, // Cap
  10: {x: 0, y: 1}  // Aqu
};

export const SouthIndianChart: React.FC<ChartProps> = ({
  planets,
  ascendant,
  width = 400,
  height = 400,
  className,
  onHouseClick,
  onPlanetClick,
  style
}) => {
  const boxW = width / 4;
  const boxH = height / 4;

  const ascSign = Math.floor(ascendant / 30);

  // Group planets by sign
  const planetsBySign: Record<number, PlanetPosition[]> = {};
  planets.forEach(p => {
    const s = Math.floor(p.longitude / 30);
    if (!planetsBySign[s]) planetsBySign[s] = [];
    planetsBySign[s].push(p);
  });

  return (
    <svg width={width} height={height} className={className} style={style} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid Lines - Simplified as Rects for each sign */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(signId => {
        const coords = SOUTH_MAP[signId];
        const x = coords.x * boxW;
        const y = coords.y * boxH;
        
        const isAsc = signId === ascSign;
        const pts = planetsBySign[signId] || [];

        return (
          <g key={signId} onClick={() => onHouseClick?.(signId)}>
            <rect x={x} y={y} width={boxW} height={boxH} fill="none" stroke="currentColor" strokeWidth="1" />
            
            {/* Sign Label (Optional, usually implied, but helpful) */}
            {/* <text x={x + 5} y={y + 15} fontSize="10" opacity={0.5}>{SIGNS[signId]}</text> */}
            
            {/* Ascendant Marker */}
            {isAsc && (
              <text x={x + boxW - 5} y={y + 15} textAnchor="end" fontSize="12" fontWeight="bold">Asc</text>
            )}

            {/* Planets */}
            {pts.map((p, i) => (
              <text
                key={p.name}
                x={x + boxW / 2}
                y={y + (boxH / 2) + ((i - (pts.length-1)/2) * 12)} // Simple stacking
                textAnchor="middle"
                fontSize="10"
                cursor={onPlanetClick ? "pointer" : "default"}
                onClick={(e) => { e.stopPropagation(); onPlanetClick?.(p); }}
              >
                {p.name.substring(0, 2)}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
};

/**
 * North Indian Chart (Diamond Style)
 * Layout: Fixed Diamond. Top Middle is Ascendant (House 1).
 * Counter-clockwise counting.
 */
export const NorthIndianChart: React.FC<ChartProps> = ({
  planets,
  ascendant,
  width = 400,
  height = 400,
  className,
  onHouseClick,
  onPlanetClick,
  style
}) => {
  // Use SVG path commands for the diamonds.
  // Standard Layout: Square with diagonals.
  // Middle Top Diamond = H1.
  // Top Left Triangle = H2. 
  // Left Diamond = H4?
  // Let's stick to standard North Indian mapping.
  // H1: Top Center Diamond.
  // H2: Top Left Triangle.
  // H3: Top Left Corner Triangle (Wait, H2 is top-left usually).
  // Counter-Clockwise?
  // House 1 (Lagna) is Top Diamond.
  // House 2 is to the Left of H1 (Top-Left Triangle).
  // House 3 is Left Diamond? No.
  // Let's define polygon points for a 100x100 coord system.
  
  const w = width;
  const h = height;
  const cx = w/2;
  const cy = h/2;

  // Points
  // Top-Left (0,0), Top-Right (w,0), Bot-Right (w,h), Bot-Left (0,h)
  // Centers: Top(cx,0), Right(w,cy), Bot(cx,h), Left(0,cy)
  
  // House Polygons
  const HOUSES = [
    // H1: Diamond Top Center
    { id: 1, pts: `${cx},${cy} ${cx},0 ${w/2-w/4},${h/4} ${w/2+w/4},${h/4}` }, // Wait, standard H1 is a diamond on top?
    // Usually H1 is the Top Diamond defined by: (0,0) to Center? No.
    // Standard: Square rotated? 
    // Usually it's a Rectangle with diagonals.
    // H1 is Top Diamond. Points: (cx, cy), (0,0)?? No.
    // H1 Points: (cx, cy) -> Center. (cx, 0) -> Top Mid. 
    // Actually, usually boundaries are Diagonals of the outer square + Midpoint connectors.
    // Let's use simple logic:
    // H1 = Top Triangle/Diamond. Vertices: (0,0)-(w,0)-(cx,cy)? No.
    // Vertices: (0,0), (w,0), (w,h), (0,h) is the frame.
    // Diagonals intersect at (cx, cy).
    // Midpoints of sides: (cx,0), (w,cy), (cx,h), (0,cy).
    // Lines connect Midpoints to define the central rhombus (H1, H4, H7, H10).
    
    // Correct Geometry:
    // H1 (Top Diamond): (cx,cy), (horizontal-mid-left?), (cx,0), (horizontal-mid-right?)
    // Actually simpler:
    // Diagonals (X shape).
    // Square (Diamond) connecting midpoints.
    // H1 = Top Diamond. Points: (cx, cy), (0+w/4?, 0+h/4?), (cx, 0)?
    // Let's just define the standard North Indian Zones.
    
    // H1: Top Diamond. (cx,cy), (cx-w/4, h/4), (cx, 0), (cx+w/4, h/4) ??
    // Let's assume the outer frame is the box.
    // H1 is the Top Quad.
    // Points: (cx, cy), (0,0) [if H2 is triangle], (w,0) [if H12 is triangle].
    // North Indian Style:
    // H1 is the Top Center Diamond.
    // H2 is Top Left Triangle.
    // H3 is Left Low Triangle?
    // H4 is Left Center Diamond.
    
    // Let's hardcode generic paths relative to w,h.
    // H1: Top Rhombus.
    { id: 1, d: `M${cx},${cy} L${w*.25},${h*.25} L${cx},0 L${w*.75},${h*.25} Z` }, // Inner? No, H1 extends to borders?
    // Actually, standard is:
    // H1 is Top Triangle? No, that's South Indian simplified.
    // North Indian:
    // 1 (Lagna) = Top Center.
    // 2 = Top Left.
    // 3 = Left Top.
    // 4 = Left Center.
    // 5 = Left Bottom.
    // 6 = Bottom Left.
    // 7 = Bottom Center.
    // 8 = Bottom Right.
    // 9 = Right Bottom.
    // 10 = Right Center.
    // 11 = Right Top.
    // 12 = Top Right.
    
    // Wait, 12 Houses.
    // 4 Central Diamonds (1, 4, 7, 10).
    // 8 Triangles (2,3, 5,6, 8,9, 11,12).
    
    // H1: Diamond. Points: (cx, cy), (0,0), (cx, 0)? No.
    // Vertices: (cx, cy) is Center.
    // (0,0) is Top-Left. 
    // H1 is bordered by H2 (Top Left) and H12 (Top Right).
    // H1 Polygon: (cx, cy), (w,0), ?? 
    // Look, standard H1 is the Top Quadrant of the X.
    // Points: (cx, cy), (w, 0), (cx, 0)?? No.
    // Points: (cx, cy), (w, 0) ?? No.
    // Intersection of Diagonals divides the square into 4 Triangles.
    // Top Triangle = H1? No, usually H1 is a DIAMOND shape in many renderings, OR the Top Triangle.
    // IF Top Triangle: Points (0,0), (w, 0), (cx, cy).
    // But then where is 2 and 12?
    // THIS IS THE "X" style.
    
    // Correct "Diamond" Style:
    // Draw Square connecting midpoints ((cx,0), (w,cy), (cx,h), (0,cy)).
    // Draw Diagonals ((0,0)->(w,h), (w,0)->(0,h)).
    // H1 = Top part of the inner Diamond.
    //   Points: (cx, cy), (w*.5 + w*.25??)
    //   Let's trace:
    //   Inner Diamond Vertices: T(cx,0), R(w,cy), B(cx,h), L(0,cy).
    //   H1 is the top diamond? No.
    //   H1 is usually the Top-Middle region.
    //   Let's map the standard regions:
    //   H1: Top Diamond. (cx, cy), (cx + w/2?, ...).
    //   Let's use the layout where H1 is a Diamond.
    //   H1: (cx, cy), (w*0.5, 0), but bounded? 
    
    // Okay, simple paths for standard chart:
    // H1: Top Diamond. (cx, cy), (w*0.75, h*0.25), (cx, 0), (w*0.25, h*0.25).
    { id: 1, d: `M${cx},${cy} L${w*0.25},${h*0.25} L${cx},0 L${w*0.75},${h*0.25} Z` }, // Top Diamond
    { id: 2, d: `M${w*0.25},${h*0.25} L0,0 L${cx},0 Z` }, // Top Left Tri (H2)
    { id: 3, d: `M0,0 L${w*0.25},${h*0.25} L0,${cy} Z` }, // Left Top Tri (H3)
    { id: 4, d: `M${cx},${cy} L${w*0.25},${h*0.25} L0,${cy} L${w*0.25},${h*0.75} Z` }, // Left Diamond (H4)
    { id: 5, d: `M0,${cy} L${w*0.25},${h*0.75} L0,${h} Z` }, // Left Bot Tri (H5)
    { id: 6, d: `M0,${h} L${w*0.25},${h*0.75} L${cx},${h} Z` }, // Bot Left Tri (H6)
    { id: 7, d: `M${cx},${cy} L${w*0.25},${h*0.75} L${cx},${h} L${w*0.75},${h*0.75} Z` }, // Bot Diamond (H7)
    { id: 8, d: `M${cx},${h} L${w*0.75},${h*0.75} L${w},${h} Z` }, // Bot Right Tri (H8)
    { id: 9, d: `M${w},${h} L${w*0.75},${h*0.75} L${w},${cy} Z` }, // Right Bot Tri (H9)
    { id: 10, d: `M${cx},${cy} L${w*0.75},${h*0.75} L${w},${cy} L${w*0.75},${h*0.25} Z` }, // Right Diamond (H10)
    { id: 11, d: `M${w},${cy} L${w*0.75},${h*0.25} L${w},0 Z` }, // Right Top Tri (H11)
    { id: 12, d: `M${w},0 L${w*0.75},${h*0.25} L${cx},0 Z` }  // Top Right Tri (H12)
  ];
  
  // Calculate House Signs
  // H1 is Ascendant Sign.
  // H2 = Asc + 1, etc.
  const ascSign = Math.floor(ascendant / 30);
  
  // Helper to get center of polygon for text
  // We can approximate or hardcode centers
  const CENTERS: Record<number, {x: number, y: number}> = {
    1: {x: cx, y: h*0.2}, // H1 higher
    2: {x: w*0.15, y: h*0.05}, // H2
    3: {x: w*0.05, y: h*0.15}, // H3
    4: {x: w*0.2, y: cy}, // H4
    5: {x: w*0.05, y: h*0.85}, // H5
    6: {x: w*0.15, y: h*0.95}, // H6
    7: {x: cx, y: h*0.8}, // H7
    8: {x: w*0.85, y: h*0.95}, // H8
    9: {x: w*0.95, y: h*0.85}, // H9
    10: {x: w*0.8, y: cy}, // H10
    11: {x: w*0.95, y: h*0.15}, // H11
    12: {x: w*0.85, y: h*0.05} // H12
  };

  // Group planets by House (1-12)
  const planetsByHouse: Record<number, PlanetPosition[]> = {};
  planets.forEach(p => {
    // Determine House relative to Ascendant
    // House = (Sign - AscSign) + 1
    const pSign = Math.floor(p.longitude / 30);
    let hIdx = (pSign - ascSign) + 1;
    if (hIdx <= 0) hIdx += 12;
    if (hIdx > 12) hIdx = (hIdx-1) % 12 + 1;
    
    if (!planetsByHouse[hIdx]) planetsByHouse[hIdx] = [];
    planetsByHouse[hIdx].push(p);
  });

  return (
    <svg width={width} height={height} className={className} style={style} viewBox={`0 0 ${width} ${height}`}>
      <g stroke="currentColor" fill="none" strokeWidth="1">
        {/* Draw Layout Frame: Outer Rect + Diagonals + Midpoint Rect */}
        <rect x="0" y="0" width={w} height={h} />
        <line x1="0" y1="0" x2={w} y2={h} />
        <line x1={w} y1="0" x2="0" y2={h} />
        <line x1={cx} y1="0" x2="0" y2={cy} />
        <line x1="0" y1={cy} x2={cx} y2={h} />
        <line x1={cx} y1={h} x2={w} y2={cy} />
        <line x1={w} y1={cy} x2={cx} y2="0" />
      </g>

      {/* House Content */}
      {HOUSES.map(house => {
        const center = CENTERS[house.id];
        const hSign = (ascSign + (house.id - 1)) % 12; // 0-11
        const signNum = hSign + 1; // 1-12 used in North Indian charts
        const pts = planetsByHouse[house.id] || [];

        return (
          <g key={house.id} onClick={() => onHouseClick?.(signNum)}>
             {/* Invisible Hit Area */}
             <path d={house.d} fill="transparent" stroke="none" pointerEvents="all" />

             {/* Sign Number */}
             <text x={center.x} y={center.y} fontSize="10" textAnchor="middle" opacity={0.6}>{signNum}</text>

             {/* Planets */}
             {pts.map((p, i) => (
              <text
                key={p.name}
                x={center.x}
                y={center.y + 12 + (i * 10)}
                textAnchor="middle"
                fontSize="9"
                fill="currentColor"
                fontWeight="bold"
                cursor={onPlanetClick ? "pointer" : "default"}
                onClick={(e) => { e.stopPropagation(); onPlanetClick?.(p); }}
              >
                {p.name.substring(0, 2)}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
};
