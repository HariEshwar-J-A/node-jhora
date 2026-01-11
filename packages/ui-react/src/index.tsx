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
import { SOUTH_GRID_MAP } from './geometry/south_grid.js';
import { useSouthLayout } from './hooks/useSouthLayout.js';

export { useSouthLayout } from './hooks/useSouthLayout.js';
export { useNorthLayout } from './hooks/useNorthLayout.js';

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
  
  const planetsBySign = useSouthLayout(planets);

  return (
    <svg width={width} height={height} className={className} style={style} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid Lines - Simplified as Rects for each sign */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(signId => {
        const coords = SOUTH_GRID_MAP[signId];
        const x = coords.x * boxW;
        const y = coords.y * boxH;
        
        const isAsc = signId === ascSign;
        const pts = planetsBySign[signId] || [];

        return (
          <g key={signId} onClick={() => onHouseClick?.(signId)}>
            <rect x={x} y={y} width={boxW} height={boxH} fill="none" stroke="currentColor" strokeWidth="1" />
            
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

export { AnimatedNorthIndianChart } from './AnimatedNorthIndianChart.js';
