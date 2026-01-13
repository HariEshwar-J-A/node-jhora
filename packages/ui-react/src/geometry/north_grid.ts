export interface HouseGeometry {
    path: string;
    center: { x: number; y: number };
    label: { x: number; y: number }; // For Sign Number
}

// 100x100 Grid - Standard North Indian "Diamond" Chart
// Layout: 1 (Top), 4 (Left), 7 (Bottom), 10 (Right) -> Counter-Clockwise Flow
export const NORTH_INDIAN_GRID: HouseGeometry[] = [
    // House 1: Top Diamond (Lagna)
    { 
        path: "M50,50 L25,25 L50,0 L75,25 Z", 
        center: {x: 50, y: 35}, // Moved center down slightly for planets
        label: {x: 50, y: 15}   // Top Tip
    },
    
    // House 2: Top-Left Zone (Upper Triangle)
    { 
        path: "M50,0 L0,0 L25,25 Z", 
        center: {x: 25, y: 10}, 
        label: {x: 10, y: 5} // Top Left Corner
    },
    
    // House 3: Top-Left Zone (Lower Triangle)
    { 
        path: "M0,0 L0,50 L25,25 Z", 
        center: {x: 10, y: 25}, 
        label: {x: 5, y: 40} // Near Left Edge
    },

    // House 4: Left Diamond (Sukh)
    { 
        path: "M50,50 L25,25 L0,50 L25,75 Z", 
        center: {x: 25, y: 50}, 
        label: {x: 15, y: 50} // Left Tip
    },

    // House 5: Bottom-Left Zone (Upper Triangle)
    { 
        path: "M0,50 L0,100 L25,75 Z", 
        center: {x: 10, y: 75}, 
        label: {x: 5, y: 60} 
    },

    // House 6: Bottom-Left Zone (Lower Triangle)
    { 
        path: "M0,100 L50,100 L25,75 Z", 
        center: {x: 25, y: 90}, 
        label: {x: 10, y: 95} 
    },

    // House 7: Bottom Diamond (Jaya)
    { 
        path: "M50,50 L25,75 L50,100 L75,75 Z", 
        center: {x: 50, y: 65}, 
        label: {x: 50, y: 85} 
    },

    // House 8: Bottom-Right Zone (Lower Triangle)
    { 
        path: "M50,100 L100,100 L75,75 Z", 
        center: {x: 75, y: 90}, 
        label: {x: 90, y: 95} 
    },

    // House 9: Bottom-Right Zone (Upper Triangle)
    { 
        path: "M100,100 L100,50 L75,75 Z", 
        center: {x: 90, y: 75}, 
        label: {x: 95, y: 60} 
    },

    // House 10: Right Diamond (Karma)
    { 
        path: "M50,50 L75,75 L100,50 L75,25 Z", 
        center: {x: 75, y: 50}, 
        label: {x: 85, y: 50} 
    },

    // House 11: Top-Right Zone (Lower Triangle)
    { 
        path: "M100,50 L100,0 L75,25 Z", 
        center: {x: 90, y: 25}, 
        label: {x: 95, y: 40} 
    },

    // House 12: Top-Right Zone (Upper Triangle)
    { 
        path: "M100,0 L50,0 L75,25 Z", 
        center: {x: 75, y: 10}, 
        label: {x: 90, y: 5} 
    }
];
