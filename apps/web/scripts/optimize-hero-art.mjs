import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.env.HERO_ART_SRC ?? join(root, 'assets/v2_astro_bg_frame_mono.png');
const outDir = join(root, 'public/images');
const outWebp = join(outDir, 'hero-astro.webp');

mkdirSync(outDir, { recursive: true });

const buf = await sharp(src)
    .rotate()
    .resize(1280, 720, { fit: 'cover', position: 'right top' })
    .webp({ quality: 68, effort: 6, smartSubsample: true })
    .toBuffer();

if (buf.byteLength > 200 * 1024) {
    const smaller = await sharp(src)
        .rotate()
        .resize(1120, 630, { fit: 'cover', position: 'right top' })
        .webp({ quality: 58, effort: 6 })
        .toBuffer();
    await sharp(smaller).toFile(outWebp);
    console.log(`hero-astro.webp: ${smaller.byteLength} bytes (quality reduced)`);
} else {
    await sharp(buf).toFile(outWebp);
    console.log(`hero-astro.webp: ${buf.byteLength} bytes`);
}
