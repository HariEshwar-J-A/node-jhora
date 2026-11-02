# Earth textures (NASA Visible Earth)

| File | Source | License |
| --- | --- | --- |
| `earth-day-*.webp` | [NASA Blue Marble / land shallow topo 2048](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg) | U.S. Government public domain (NASA Earth Observatory) |
| `earth-night-*.webp` | [NASA Black Marble 2012 (3600×1800)](https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg) | U.S. Government public domain (NASA Earth Observatory) |
| `night-sky-fallback.webp` | Generated in-repo (`scripts/optimize-earth-textures.mjs`) | Same as site (proprietary UI asset) |

Regenerate WebP variants:

```bash
node scripts/optimize-earth-textures.mjs
```

Desktop maps are 2048×1024 WebP; mobile maps are 1024×512. Total shipped texture payload is under ~250 KB.

Owner hero art (2D section motif): `assets/v2_astro_bg_frame_mono.png` → `public/images/hero-astro.webp` via `scripts/optimize-hero-art.mjs`.

Constellation stick figures in `src/components/space-intro/constellations.ts` are hand-authored for this demo (not imported from GPL star-catalogue artwork).
