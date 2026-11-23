export type DocBlock =
    | { type: 'p'; text: string }
    | { type: 'h3'; text: string }
    | { type: 'code'; language?: string; code: string }
    | { type: 'ul'; items: string[] };

export interface DocPage {
    slug: string;
    title: string;
    description: string;
    blocks: DocBlock[];
}

export const DOC_PAGES: DocPage[] = [
    {
        slug: '',
        title: 'Documentation',
        description: 'User guide for the @node-jhora library (Node.js and browser).',
        blocks: [
            {
                type: 'p',
                text: 'node-jhora is a proprietary Vedic astrology calculation stack built on a pure TypeScript JPL DE440s reader. Packages are published on npm and JSR under the @node-jhora scope.',
            },
            {
                type: 'p',
                text: 'Use the sidebar to jump to install steps, API topics, and the live chart demo. All examples use fictional Greenwich sample data unless noted.',
            },
        ],
    },
    {
        slug: 'install',
        title: 'Install',
        description: 'Add packages from npm or JSR.',
        blocks: [
            {
                type: 'h3',
                text: 'npm (Node.js 22+)',
            },
            {
                type: 'code',
                language: 'bash',
                code: `npm install @node-jhora/core @node-jhora/ephe
# Optional layers
npm install @node-jhora/analytics @node-jhora/prediction @node-jhora/match`,
            },
            {
                type: 'h3',
                text: 'JSR',
            },
            {
                type: 'code',
                language: 'bash',
                code: `npx jsr add @node-jhora/core
npx jsr add @node-jhora/ephe`,
            },
            {
                type: 'p',
                text: 'Published library packages include core, analytics, prediction, match, events, format, engine, atlas, and ephe (kernel data only). The monorepo root is not published.',
            },
        ],
    },
    {
        slug: 'quickstart-node',
        title: 'Quick start (Node)',
        description: 'Initialize DE440s and compute a chart.',
        blocks: [
            {
                type: 'p',
                text: 'Call EphemerisEngine.initialize() before any planetary math. The kernel resolves from @node-jhora/ephe, NODE_JHORA_EPHE_PATH, or the download cache.',
            },
            {
                type: 'code',
                code: `import { EphemerisEngine, NodeJHora } from '@node-jhora/core';

const eph = EphemerisEngine.getInstance();
await eph.initialize();

const chart = await NodeJHora.calculate(
  new Date('2000-01-01T12:00:00.000Z'),
  { latitude: 51.4769, longitude: -0.0005 },
  'TrueChitra',
);

console.log(chart.planets.find((p) => p.name === 'Moon')?.longitude);`,
            },
        ],
    },
    {
        slug: 'quickstart-browser',
        title: 'Quick start (browser)',
        description: 'Load kernel bytes without Node fs.',
        blocks: [
            {
                type: 'p',
                text: 'Import @node-jhora/core/browser. Pass kernel bytes to initialize(), or use ensureEphemerisBytes() to fetch and cache de440s.bsp (CORS-enabled CDN or same-origin host).',
            },
            {
                type: 'code',
                code: `import { EphemerisEngine, ensureEphemerisBytes } from '@node-jhora/core/browser';

const bytes = await ensureEphemerisBytes({
  urls: ['https://cdn.jsdelivr.net/npm/@node-jhora/ephe@440.3.0/de440s.bsp'],
});
const eph = EphemerisEngine.getInstance();
await eph.initialize({ kernel: bytes });`,
            },
            {
                type: 'p',
                text: 'Run heavy work in a Web Worker (see @node-jhora/engine/browser worker helpers). This demo site uses Comlink with plain JSON results.',
            },
        ],
    },
    {
        slug: 'ephemeris',
        title: 'Ephemeris kernel',
        description: 'DE440s coverage and integrity.',
        blocks: [
            {
                type: 'p',
                text: 'Default kernel: JPL DE440s (de440s.bsp), 32,726,016 bytes, pinned SHA-256 in @node-jhora/core/browser. Valid TDB range approximately 1849-12-26 through 2150-01-22.',
            },
            {
                type: 'p',
                text: 'No Swiss Ephemeris and no WASM: the reader is pure TypeScript over JPL SPK data (U.S. public domain).',
            },
            {
                type: 'code',
                code: `import { DE440S_BYTES, DE440S_SHA256 } from '@node-jhora/core/browser';`,
            },
        ],
    },
    {
        slug: 'settings',
        title: 'Settings & presets',
        description: 'Ayanamsa, houses, and calculation presets.',
        blocks: [
            {
                type: 'p',
                text: 'Default ayanamsa is True Chitrapaksha (settings id true_citra, engine mode 27). Named presets include node-jhora-default, jhora-default@8.0, kp, raman, and lahiri-mean.',
            },
            {
                type: 'code',
                code: `import { getPreset, AYANAMSA_IDS, HOUSE_SYSTEM_IDS } from '@node-jhora/core';

const settings = getPreset('node-jhora-default');
// 9 named ayanamsa ids in AYANAMSA_IDS; 26 house systems in HOUSE_SYSTEM_IDS`,
            },
            {
                type: 'ul',
                items: [
                    'positionMode: geometric (JHora default, no light-time/aberration)',
                    'nodeType: true (osculating Rahu/Ketu by default in node-jhora-default)',
                    'dasamsaScheme and varga variant indexes via settings.vargaVariants',
                ],
            },
        ],
    },
    {
        slug: 'vargas',
        title: 'Divisional charts',
        description: 'calculateVarga and named divisors through D150.',
        blocks: [
            {
                type: 'p',
                text: 'calculateVarga(longitude, division) supports named divisors 1–12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144, 150 with scheme options for D2, D3, D9, D10, etc. Unknown divisors use a harmonic fallback.',
            },
            {
                type: 'code',
                code: `import { calculateVarga } from '@node-jhora/core';

const d9 = calculateVarga(moonLongitude, 9);
const d150 = calculateVarga(moonLongitude, 150);`,
            },
            {
                type: 'p',
                text: 'ChartSession (engine) batches D1–D60 (16 charts). Compute additional divisors directly when you need D5, D81, D108, or custom N.',
            },
        ],
    },
    {
        slug: 'dashas',
        title: 'Dasha systems',
        description: 'Time lords from @node-jhora/prediction.',
        blocks: [
            {
                type: 'p',
                text: 'Vimshottari: generateVimshottari(birthDate, moonLon, depth) with depth up to 5 (Maha → Prana). Also Yogini, Kalachakra, cyclic rashis (Ashtottari, Shodashottari, …), Jaimini Chara, Narayana, Drig, Sudasa, Moola, Patyayini.',
            },
            {
                type: 'code',
                code: `import { DateTime } from 'luxon';
import { generateVimshottari, YoginiDasha } from '@node-jhora/prediction';

const birth = DateTime.fromISO('2000-01-01T12:00', { zone: 'UTC' });
const tree = generateVimshottari(birth, moonLongitude, 3);
const yogini = YoginiDasha.calculate(moonLongitude, birth);`,
            },
            {
                type: 'p',
                text: 'Dasha functions expect Luxon DateTime, not native Date.',
            },
        ],
    },
    {
        slug: 'panchanga',
        title: 'Panchanga',
        description: 'Tithi, nakshatra, yoga, karana, vara.',
        blocks: [
            {
                type: 'p',
                text: 'calculatePanchanga(sunLong, moonLong, date) returns indices and elapsed fractions. Sunrise and sunset use computeRiseSetTable from the core rise/set module.',
            },
            {
                type: 'code',
                code: `import { calculatePanchanga, computeRiseSetTable } from '@node-jhora/core';`,
            },
        ],
    },
    {
        slug: 'matching',
        title: 'Matching',
        description: 'Kuta and Porutham from @node-jhora/match.',
        blocks: [
            {
                type: 'p',
                text: 'Ashta Kuta (36 points), Dasha Kuta (10-kuta South), PoruthamMatch, and checkMangalDosha operate on nakshatra indices (0–26) and sign numbers (1–12).',
            },
            {
                type: 'code',
                code: `import { calculateAshtaKuta, PoruthamMatch } from '@node-jhora/match';`,
            },
        ],
    },
    {
        slug: 'strength',
        title: 'Strength & yogas',
        description: 'Shadbala, ashtakavarga, yoga rules.',
        blocks: [
            {
                type: 'p',
                text: 'calculateShadbala and Ashtakavarga live in @node-jhora/analytics. YogaEngine.findYogas uses the built-in YOGA_LIBRARY (seven Raja yogas in the current release).',
            },
            {
                type: 'code',
                code: `import { calculateShadbala, Ashtakavarga, YogaEngine, YOGA_LIBRARY } from '@node-jhora/analytics';`,
            },
        ],
    },
    {
        slug: 'kp',
        title: 'KP significators',
        description: 'Sub-lords and house significators.',
        blocks: [
            {
                type: 'p',
                text: 'KPSubLord.calculateKPSignificators and KPEngine.getAllHouseSignificators / getAllPlanetSignificators are exported from analytics (and KP helpers from core).',
            },
            {
                type: 'code',
                code: `import { KPEngine } from '@node-jhora/analytics';`,
            },
        ],
    },
    {
        slug: 'transits',
        title: 'Transits & events',
        description: 'Ingress scanning and generic root finding.',
        blocks: [
            {
                type: 'p',
                text: 'TransitEngine (prediction) finds sign/nakshatra changes. @node-jhora/events provides TransitScanner, findIngress, and findStationaryPoint.',
            },
            {
                type: 'code',
                code: `import { TransitEngine } from '@node-jhora/prediction';
import { findIngress, TransitScanner } from '@node-jhora/events';`,
            },
        ],
    },
    {
        slug: 'import-export',
        title: 'Import & export',
        description: 'JHD and NJH chart files.',
        blocks: [
            {
                type: 'p',
                text: '@node-jhora/format exposes parseJhd, writeJhd, parseNjh, and serializeNjh for browser-safe chart interchange. Folder import is Node-only (@node-jhora/format/node).',
            },
            {
                type: 'code',
                code: `import { parseJhd, writeJhd } from '@node-jhora/format/jhd';
import { parseNjh, serializeNjh } from '@node-jhora/format';`,
            },
        ],
    },
];

export function docBySlug(slug: string): DocPage | undefined {
    return DOC_PAGES.find((p) => p.slug === slug);
}

export function docPath(slug: string): string {
    return slug ? `/docs/${slug}` : '/docs';
}
