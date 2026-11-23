# Hero background art

`hero-astro.webp` is generated from `../assets/v2_astro_bg_frame_mono.png` into `src/assets/hero-astro.webp` (owner-provided monochrome frame: starfield, Jupiter, Cancer/Leo line art, no text). Vite content-hashes it, so it is cached with the other `/astrology/assets/*` files.

Regenerate:

```bash
node scripts/optimize-hero-art.mjs
```

Target: landscape crop (~1400×788), WebP, under ~200 KB.
