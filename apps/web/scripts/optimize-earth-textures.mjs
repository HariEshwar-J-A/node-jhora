/**
 * Build self-hosted Earth WebP maps from NASA public-domain imagery.
 *
 * Sources (override with EARTH_*_SRC):
 *   day    Blue Marble Next Generation, December 2004, topo+bathy
 *          https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg
 *   night  Black Marble 2012
 *          https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg
 *   clouds NASA Blue Marble cloud composite
 *          https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg
 *   moon   LRO wide-angle color mosaic (optional)
 *          https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg
 *
 * Specular and normal maps are derived here from the day image. They are not
 * a third-party texture pack. WebP is used because this repo has no KTX2 /
 * Basis encoder. Desktop is 4096×2048; mobile is 2048×1024.
 */
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/textures');

const SIZES = {
    desktop: { w: 4096, h: 2048 },
    mobile: { w: 2048, h: 1024 },
};

const daySrc = process.env.EARTH_DAY_SRC ?? '/tmp/earth-src/day.jpg';
const nightSrc = process.env.EARTH_NIGHT_SRC ?? '/tmp/earth-src/night.jpg';
const cloudSrc = process.env.EARTH_CLOUDS_SRC ?? '/tmp/earth-src/clouds.jpg';
const moonSrc = process.env.EARTH_MOON_SRC ?? '/tmp/earth-src/moon.jpg';

function waterSpec(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum > 176 && sat < 0.22) return 148;
    const blueLead = b - Math.max(r, g * 0.9);
    if (blueLead > 6 && sat > 0.14 && lum < 150) return 236;
    if (b > r + 5 && g > r && lum < 165 && sat > 0.1) return 210;
    return 16;
}

function deriveMaps(rgb, w, h) {
    const spec = new Uint8Array(w * h);
    const height = new Float32Array(w * h);
    for (let i = 0, p = 0; i < w * h; i++, p += 3) {
        const r = rgb[p];
        const g = rgb[p + 1];
        const b = rgb[p + 2];
        const s = waterSpec(r, g, b);
        spec[i] = s;
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        height[i] = s > 200 ? 0 : lum;
    }

    const tmp = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < h; y++) {
            const row = y * w;
            for (let x = 0; x < w; x++) {
                const xm = (x + w - 1) % w;
                const xp = (x + 1) % w;
                tmp[row + x] = (height[row + xm] + height[row + x] + height[row + xp]) / 3;
            }
        }
        for (let y = 0; y < h; y++) {
            const y0 = Math.max(0, y - 1);
            const y1 = Math.min(h - 1, y + 1);
            for (let x = 0; x < w; x++) {
                height[y * w + x] = (tmp[y0 * w + x] + tmp[y * w + x] + tmp[y1 * w + x]) / 3;
            }
        }
    }

    const normal = Buffer.alloc(w * h * 3);
    const strength = 3.4;
    for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - 1);
        const y1 = Math.min(h - 1, y + 1);
        const lat = (0.5 - y / (h - 1)) * Math.PI;
        const cosLat = Math.max(0.22, Math.cos(lat));
        for (let x = 0; x < w; x++) {
            const xm = (x + w - 1) % w;
            const xp = (x + 1) % w;
            const row = y * w;
            const dx = (height[row + xp] - height[row + xm]) * strength * cosLat;
            const dy = (height[y1 * w + x] - height[y0 * w + x]) * strength;
            const len = Math.hypot(dx, dy, 1);
            const o = (row + x) * 3;
            normal[o] = Math.round((-dx / len) * 127.5 + 127.5);
            normal[o + 1] = Math.round((-dy / len) * 127.5 + 127.5);
            normal[o + 2] = Math.round((1 / len) * 127.5 + 127.5);
        }
    }
    return { spec, normal };
}

async function encodeColor(name, srcPath, quality) {
    for (const [label, { w, h }] of Object.entries(SIZES)) {
        const out = join(outDir, `${name}-${label}.webp`);
        await sharp(srcPath)
            .rotate()
            .resize(w, h, { fit: 'fill' })
            .webp({ quality, effort: 4, smartSubsample: true })
            .toFile(out);
        console.log(`${name}-${label}.webp  ${statSync(out).size} bytes`);
    }
}

async function encodeDerived(rgb, w, h, label) {
    const { spec, normal } = deriveMaps(rgb, w, h);
    const specOut = join(outDir, `earth-spec-${label}.webp`);
    const normalOut = join(outDir, `earth-normal-${label}.webp`);
    await sharp(spec, { raw: { width: w, height: h, channels: 1 } })
        .blur(0.4)
        .webp({ quality: label === 'desktop' ? 74 : 70, effort: 4 })
        .toFile(specOut);
    await sharp(normal, { raw: { width: w, height: h, channels: 3 } })
        .webp({ quality: label === 'desktop' ? 88 : 82, effort: 4, smartSubsample: false })
        .toFile(normalOut);
    console.log(
        `earth-spec-${label}.webp  ${statSync(specOut).size} bytes`,
        `earth-normal-${label}.webp  ${statSync(normalOut).size} bytes`,
    );
}

mkdirSync(outDir, { recursive: true });

await encodeColor('earth-day', daySrc, 76);
await encodeColor('earth-night', nightSrc, 70);
await encodeColor('earth-clouds', cloudSrc, 68);

for (const [label, { w, h }] of Object.entries(SIZES)) {
    const { data } = await sharp(daySrc)
        .rotate()
        .resize(w, h, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    await encodeDerived(data, w, h, label);
}

const moonOut = join(outDir, 'earth-moon.webp');
await sharp(moonSrc)
    .rotate()
    .resize(1024, 512, { fit: 'fill' })
    .webp({ quality: 80, effort: 4 })
    .toFile(moonOut);
console.log(`earth-moon.webp  ${statSync(moonOut).size} bytes`);

const fallback = join(outDir, 'night-sky-fallback.webp');
await sharp({
    create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 2, g: 4, b: 12 },
    },
})
    .composite([
        {
            input: Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
  ${Array.from({ length: 160 }, (_, i) => {
      const x = (i * 97) % 1600;
      const y = (i * 53) % 900;
      const o = 0.35 + (i % 5) * 0.12;
      const r = i % 11 === 0 ? 1.4 : 0.7;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${o}"/>`;
  }).join('')}
</svg>`),
            top: 0,
            left: 0,
        },
    ])
    .webp({ quality: 78 })
    .toFile(fallback);
console.log(`night-sky-fallback.webp  ${statSync(fallback).size} bytes`);
