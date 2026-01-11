import React, { useState, useRef, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { PlanetPosition as CorePlanetPosition } from '@node-jhora/core';
import { ChartProps } from './index.js';
import { PortalTooltip } from './PortalTooltip.js';
import { SOUTH_GRID_MAP, BoxCoordinate } from './geometry/south_grid.js';
import { useSouthLayout } from './hooks/useSouthLayout.js';

interface PlanetPosition extends CorePlanetPosition {
    isRetrograde?: boolean;
}

// --- Variants ---
const planetVariants: Variants = {
  default: { scale: 1, opacity: 1, filter: "grayscale(0%)", zIndex: 1 },
  hovered: { scale: 1.3, opacity: 1, filter: "brightness(1.2)", zIndex: 10 },
  dimmed: { scale: 0.9, opacity: 0.4, filter: "grayscale(50%)", zIndex: 0 }
};

const gridVariants: Variants = {
  default: { opacity: 0.6, strokeWidth: 1 },
  dimmed: { opacity: 0.2, strokeWidth: 0.5 }
};

export const AnimatedSouthIndianChart: React.FC<ChartProps> = ({
  planets,
  ascendant,
  width = 400,
  height = 400,
  className,
  onHouseClick,
  onPlanetClick,
  style
}) => {
  const [hoveredPlanet, setHoveredPlanet] = useState<CorePlanetPosition | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const boxW = width / 4;
  const boxH = height / 4;
  const ascSign = Math.floor(ascendant / 30);

  // Group planets using hook
  const planetsBySign = useSouthLayout(planets);

  // Handle Mouse Move for Tooltip
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (hoveredPlanet) {
            setMousePos({ x: e.clientX, y: e.clientY });
        }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [hoveredPlanet]);

  return (
    <>
      <svg width={width} height={height} className={className} style={{...style, overflow: 'visible'}} viewBox={`0 0 ${width} ${height}`}>
         {/* Background / Grid */}
         <motion.g
           animate={hoveredPlanet ? "dimmed" : "default"}
           variants={gridVariants}
           transition={{ duration: 0.3 }}
         >
           {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(signId => {
             const coords = SOUTH_GRID_MAP[signId];
             const x = coords.x * boxW;
             const y = coords.y * boxH;
             return (
               <rect 
                  key={signId}
                  x={x} y={y} width={boxW} height={boxH} 
                  fill="none" 
                  stroke="currentColor" 
                  onClick={() => onHouseClick?.(signId)}
                  pointerEvents="all"
                  cursor="pointer"
               />
             );
           })}
         </motion.g>

         {/* Content Layer (Planets + ASC) */}
         {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(signId => {
             const coords = SOUTH_GRID_MAP[signId];
             const x = coords.x * boxW;
             const y = coords.y * boxH;
             const pts = planetsBySign[signId] || [];
             const isAsc = signId === ascSign;

             return (
               <g key={signId}>
                  {/* Ascendant Label */}
                  {isAsc && (
                    <motion.text
                      x={x + boxW - 5} y={y + 15} textAnchor="end" fontSize="12" fontWeight="bold"
                      animate={hoveredPlanet ? { opacity: 0.3 } : { opacity: 1 }}
                    >
                      Asc
                    </motion.text>
                  )}

                  {/* Planets */}
                  {pts.map((p, i) => {
                    let state = 'default';
                    if (hoveredPlanet) {
                        state = (hoveredPlanet.id === p.id) ? 'hovered' : 'dimmed';
                    }

                    // Calculate center for text
                    const txtX = x + boxW / 2;
                    const txtY = y + (boxH / 2) + ((i - (pts.length-1)/2) * 14);

                    return (
                       <motion.g
                         key={p.name}
                         initial="default"
                         animate={state}
                         variants={planetVariants}
                         transition={{ type: "spring", stiffness: 300, damping: 20 }}
                         style={{ transformOrigin: `${txtX}px ${txtY}px` }}
                         onMouseEnter={() => setHoveredPlanet(p)}
                         onMouseLeave={() => setHoveredPlanet(null)}
                         onClick={(e: React.MouseEvent) => { e.stopPropagation(); onPlanetClick?.(p); }}
                         cursor="pointer"
                       >
                         {/* Glow Effect */}
                         <motion.circle 
                            cx={txtX} cy={txtY - 4} r={12} 
                            fill="url(#glowGradient)" 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: state === 'hovered' ? 0.6 : 0 }}
                         />
                         
                         <text
                           x={txtX}
                           y={txtY}
                           textAnchor="middle"
                           fontSize="10"
                           fontWeight={state === 'hovered' ? 'bold' : 'normal'}
                           fill="currentColor"
                         >
                           {p.name.substring(0, 2)}
                           {p.speed < 0 ? '[R]' : ''}
                         </text>
                       </motion.g>
                    );
                  })}
               </g>
             );
         })}
         
         {/* Definitions */}
         <defs>
            <radialGradient id="glowGradient">
                <stop offset="0%" stopColor="#ffff00" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ffff00" stopOpacity="0" />
            </radialGradient>
         </defs>
      </svg>

      {/* Portal Tooltip */}
      <PortalTooltip 
        visible={!!hoveredPlanet}
        x={mousePos.x}
        y={mousePos.y}
        content={
            hoveredPlanet && (
                <div>
                    <div style={{fontWeight: 'bold', marginBottom: '2px'}}>{hoveredPlanet.name} {hoveredPlanet.speed < 0 ? '[R]' : ''}</div>
                    <div style={{opacity: 0.8}}>
                        {Math.floor(hoveredPlanet.longitude % 30)}° {Math.floor((hoveredPlanet.longitude % 1) * 60)}'
                    </div>
                    <div style={{fontSize: '10px', marginTop: '4px', opacity: 0.6}}>
                        Speed: {hoveredPlanet.speed.toFixed(2)} / day
                    </div>
                </div>
            )
        }
      />
    </>
  );
};
