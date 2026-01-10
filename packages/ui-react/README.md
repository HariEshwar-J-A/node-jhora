# @node-jhora/ui-react

Professional, lightweight, and mathematically precise Vedic Astrology charts for React.
Designed to work seamlessly with `@node-jhora/core`.

## Features
- **Headless & Flexible**: Pure SVG components that you can style via CSS or props.
- **Zero Heavy Dependencies**: Depends only on React and `@node-jhora/core`.
- **Standards Compliant**: Supports both **South Indian** (Rasi box) and **North Indian** (Diamond) layouts.
- **Interactive**: Built-in support for click handlers on Planets and Houses.
- **Premium Animations**: `AnimatedSouthIndianChart` features physics-based "Focus Mode" and floating tooltips.

## Installation

```bash
npm install @node-jhora/ui-react @node-jhora/core framer-motion
```
*(Note: `framer-motion` is required only if you use the Animated components)*

## Usage

### 1. Standard Static Charts

```tsx
import { SouthIndianChart, NorthIndianChart } from '@node-jhora/ui-react';
import { NodeJHora } from '@node-jhora/core';

// Get Data
const client = new NodeJHora({ latitude: 12, longitude: 80 });
const { planets, houses } = client.getChart(new Date());

// Render
const MyChart = () => (
  <div style={{ display: 'flex', gap: '20px' }}>
    <SouthIndianChart 
      planets={planets} 
      ascendant={houses.ascendant} 
      width={400} 
      height={400}
      onPlanetClick={(p) => console.log(p.name)} 
    />
    
    <NorthIndianChart 
      planets={planets} 
      ascendant={houses.ascendant} 
      width={400} 
      height={400} 
    />
  </div>
);
```

### 2. Premium Animated Chart

The `AnimatedSouthIndianChart` provides a state-of-the-art user experience.
- **Focus Mode**: Hovering a planet zooms it while dimming the rest of the chart.
- **Data Tooltips**: Smooth, portal-based tooltips follow the cursor.
- **Retrograde Marking**: Automatically marks planets as `[R]` if speed < 0.

```tsx
import { AnimatedSouthIndianChart } from '@node-jhora/ui-react';

const MyPremiumApp = () => (
  <div className="chart-container">
    <AnimatedSouthIndianChart 
      planets={planets} 
      ascendant={houses.ascendant} 
      width={600} 
      height={600}
      style={{ color: '#FCD34D' }} // Gold Theme
    />
  </div>
);
```

## Styling
The charts render standard SVGs. You can override styles using the `className` prop or inline `style`.
- Text elements inherit `fill="currentColor"`, so setting `color` on the container works.
- Lines use `stroke="currentColor"`.

## Architecture
- **Coordinates**: The library uses internal hardcoded maps for South (Box 0-11) and North (House 1-12) layouts.
- **Logic**: Planets are mapped to signs (South) or houses relative to Ascendant (North) automatically.

## License
MIT
