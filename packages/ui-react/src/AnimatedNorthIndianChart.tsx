import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { PlanetPosition as CorePlanetPosition } from '@node-jhora/core';
import { ChartProps } from './index.js';
import { PortalTooltip } from './PortalTooltip.js';
import { NORTH_INDIAN_GRID } from './geometry/north_grid.js';
import { useNorthLayout, RenderablePlanet } from './hooks/useNorthLayout.js';

// --- Variants ---
const planetVariants: Variants = {
  default: { scale: 1, opacity: 1, filter: "grayscale(0%)", zIndex: 1 },
  hovered: { scale: 1.3, opacity: 1, filter: "brightness(1.2)", zIndex: 10 },
  dimmed: { scale: 0.9, opacity: 0.4, filter: "grayscale(50%)", zIndex: 0 }
};

const houseVariants: Variants = {
    default: { opacity: 1, strokeWidth: 1, fill: 'transparent' },
    dimmed: { opacity: 0.3, strokeWidth: 0.5, fill: 'transparent' }
};

export const AnimatedNorthIndianChart: React.FC<ChartProps> = ({
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

  // Sign Index for Ascendant (0-11) -> Used to label House 1
  const ascSignIndex = Math.floor(ascendant / 30);
  
  // Get Computed Layout (Planets grouped by House 1-12)
  // Note: groupedPlanets[0] is House 1
  const groupedPlanets = useNorthLayout(planets, ascSignIndex + 1);

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

  // Scalers for SVG (Defined as 100x100)
  const scaleX = width / 100;
  const scaleY = height / 100;

  return (
    <>
      <svg width={width} height={height} className={className} style={{...style, overflow: 'visible'}} viewBox={`0 0 100 100`}>
         {/* Houses Layer */}
         <motion.g animate={hoveredPlanet ? "dimmed" : "default"} variants={houseVariants}>
             {NORTH_INDIAN_GRID.map((house, i) => {
                 const houseNum = i + 1;
                 const signNum = ((ascSignIndex + i) % 12) + 1; // Sign Number (1-12)

                 return (
                     <g key={`house-${houseNum}`}>
                         <path 
                            d={house.path} 
                            stroke="currentColor" 
                            vectorEffect="non-scaling-stroke"
                            onClick={() => onHouseClick?.(houseNum)}
                            cursor="pointer"
                         />
                         {/* Sign Label */}
                         <text 
                            x={house.label.x} 
                            y={house.label.y} 
                            fontSize="4" 
                            textAnchor="middle" 
                            fill="currentColor"
                            opacity={0.6}
                         >
                             {signNum}
                         </text>
                     </g>
                 );
             })}
         </motion.g>

         {/* Planets Layer */}
         {groupedPlanets.map((housePlanets, i) => {
             const houseGeom = NORTH_INDIAN_GRID[i];
             const houseCenter = houseGeom.center;
             
             // Simple vertical stack layout around center
             // Offset start Y upwards based on count
             const startY = houseCenter.y - ((housePlanets.length - 1) * 3) / 2;

             return (
                 <g key={`planets-h${i+1}`}>
                     {housePlanets.map((p, idx) => {
                         let state = 'default';
                         if (hoveredPlanet) {
                             state = (hoveredPlanet.id === p.id) ? 'hovered' : 'dimmed';
                         }
                         
                         const px = houseCenter.x;
                         const py = startY + (idx * 4); // 4 units vertical spacing in 100x100 system

                         return (
                            <motion.g
                                key={p.id}
                                initial="default"
                                animate={state}
                                variants={planetVariants}
                                style={{ transformOrigin: `${px}px ${py}px` }}
                                onMouseEnter={() => setHoveredPlanet(p)}
                                onMouseLeave={() => setHoveredPlanet(null)}
                                onClick={(e) => { e.stopPropagation(); onPlanetClick?.(p); }}
                                cursor="pointer"
                            >
                                <text
                                    x={px} 
                                    y={py} 
                                    fontSize="3.5" 
                                    textAnchor="middle" 
                                    fill="currentColor"
                                    fontWeight={state === 'hovered' ? 'bold' : 'normal'}
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
      </svg>

      {/* Portal Tooltip */}
      <PortalTooltip 
        visible={!!hoveredPlanet}
        x={mousePos.x}
        y={mousePos.y}
        content={
            hoveredPlanet && (
                 <div>
                    <div style={{fontWeight: 'bold', marginBottom: '2px'}}>
                        {hoveredPlanet.name} {hoveredPlanet.speed < 0 ? '[R]' : ''}
                    </div>
                    <div style={{opacity: 0.8}}>
                        {Math.floor(hoveredPlanet.longitude % 30)}° {Math.floor((hoveredPlanet.longitude % 1) * 60)}'
                    </div>
                </div>
            )
        }
      />
    </>
  );
};
