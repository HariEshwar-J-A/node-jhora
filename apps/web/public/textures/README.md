# Earth textures (NASA, public domain)

Self-hosted WebP. Desktop maps are 4096×2048; mobile maps are 2048×1024.
KTX2 is not used: this repo has no Basis Universal encoder. Specular and
normal maps are derived in `scripts/optimize-earth-textures.mjs` from the
Blue Marble day image (ocean mask from blue-dominant pixels, land normals
from luminance). They are not a third-party texture pack.

| File                      | Source                                                                                                                                                                      | License                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `earth-day-*.webp`        | [Blue Marble Next Generation, December 2004, topo+bathy, 5400×2700](https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg) | U.S. Government public domain (NASA)                   |
| `earth-night-*.webp`      | [Black Marble 2012, 3600×1800](https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg)                                        | U.S. Government public domain (NASA Earth Observatory) |
| `earth-clouds-*.webp`     | [Blue Marble cloud composite, 2048×1024](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg)                                            | U.S. Government public domain (NASA)                   |
| `earth-spec-*.webp`       | Derived here from the Blue Marble day image                                                                                                                                 | Same public-domain source                              |
| `earth-normal-*.webp`     | Derived here from Blue Marble land luminance                                                                                                                                | Same public-domain source                              |
| `earth-moon.webp`         | [LRO WAC color mosaic, 1024×512](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg)                                                             | U.S. Government public domain (NASA/GSFC/LRO)          |
| `night-sky-fallback.webp` | Generated in-repo when WebGL is unavailable                                                                                                                                 | Site asset                                             |

Regenerate:

```bash
node scripts/optimize-earth-textures.mjs
```

Place the NASA originals at `/tmp/earth-src/{day,night,clouds,moon}.jpg`, or set
`EARTH_DAY_SRC`, `EARTH_NIGHT_SRC`, `EARTH_CLOUDS_SRC`, and `EARTH_MOON_SRC`.

The night and cloud masters are smaller than 4K, so the desktop maps upscale
them. The day master is 5400×2700 and is downscaled.

Owner hero art (2D section motif): `assets/v2_astro_bg_frame_mono.png` → `public/images/hero-astro.webp` via `scripts/optimize-hero-art.mjs`.

Constellation stick figures in `src/components/space-intro/constellations.ts` are hand-authored for this demo (not imported from GPL star-catalogue artwork).
