import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/textures');

const SIZES = {
    desktop: { w: 2048, h: 1024, q: 72 },
    mobile: { w: 1024, h: 512, q: 68 },
};

async function encodePair(name, srcPath) {
    for (const [label, { w, h, q }] of Object.entries(SIZES)) {
        const out = join(outDir, `${name}-${label}.webp`);
        await sharp(srcPath)
            .rotate()
            .resize(w, h, { fit: 'fill' })
            .webp({ quality: q, effort: 6 })
            .toFile(out);
        const { size } = await import('node:fs').then((fs) => ({
            size: fs.statSync(out).size,
        }));
        console.log(`${out}: ${size} bytes`);
    }
}

mkdirSync(outDir, { recursive: true });

const daySrc = process.env.EARTH_DAY_SRC ?? '/tmp/earth-day-src.jpg';
const nightSrc = process.env.EARTH_NIGHT_SRC ?? '/tmp/earth-night-src.jpg';

await encodePair('earth-day', daySrc);
try {
    await encodePair('earth-night', nightSrc);
} catch {
    console.warn('Night texture missing; generating dim night from day map');
    await sharp(daySrc)
        .rotate()
        .resize(2048, 1024, { fit: 'fill' })
        .modulate({ brightness: 0.08, saturation: 0.3 })
        .webp({ quality: 70 })
        .toFile(join(outDir, 'earth-night-desktop.webp'));
    await sharp(daySrc)
        .rotate()
        .resize(1024, 512, { fit: 'fill' })
        .modulate({ brightness: 0.08, saturation: 0.3 })
        .webp({ quality: 68 })
        .toFile(join(outDir, 'earth-night-mobile.webp'));
}

const fallback = join(outDir, 'night-sky-fallback.webp');
await sharp({
    create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 6, g: 8, b: 14 },
    },
})
    .composite([
        {
            input: Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
  ${Array.from({ length: 120 }, (_, i) => {
      const x = (i * 97) % 1600;
      const y = (i * 53) % 900;
      const o = 0.15 + (i % 7) * 0.08;
      return `<circle cx="${x}" cy="${y}" r="1" fill="white" opacity="${o}"/>`;
  }).join('')}
</svg>`),
            top: 0,
            left: 0,
        },
    ])
    .webp({ quality: 78 })
    .toFile(fallback);
console.log(`fallback: ${(await import('node:fs')).statSync(fallback).size} bytes`);
