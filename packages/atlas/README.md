# @node-jhora/atlas

Offline city gazetteer built from GeoNames (`cities1000`, admin codes, timezones, and alternate names). Supports prefix search with diacritic folding (Latin, Greek, Cyrillic accents; Hebrew and Arabic vowel points) and resolves aliases such as Chennai, Madras, and `चेन्नई` to the same record. Indic vowel signs and viramas, Thai vowels, and kana voicing marks are kept, so `बैरूत` (Beirut) and `बेरात` (Berat) or `ながの` (Nagano) and `なかの` (Nakano) stay distinct.

Results are ranked exact match first, then by population (descending), then by GeoNames id, so `resolve('london')` returns London, GB and `resolve('paris')` returns Paris, FR.

## Data

- **Source:** GeoNames (CC-BY 4.0). See [ATTRIBUTION.md](./ATTRIBUTION.md).
- **Build:** `pnpm --filter @node-jhora/atlas atlas:build` downloads upstream dumps into `.cache/` (not committed) and writes sharded JSON under `data/`.
- **Tests** use a tiny fixture under `tests/fixtures/gazetteer-mini/` so CI does not download GeoNames.

Generated `data/` is **not** committed (a full build is ~31 MB with population-tiered aliases; raw GeoNames downloads stay in `.cache/`). CI uses `tests/fixtures/gazetteer-mini/`. For production, run `atlas:build` in your pipeline or ship the `data/` directory as a static asset (optionally gzip the JSON shards for transfer).

## Usage

```typescript
import { loadGazetteerFromDirectory } from '@node-jhora/atlas/node';

const gazetteer = await loadGazetteerFromDirectory(new URL('./data', import.meta.url));
const hits = gazetteer.search('chennai', { limit: 5 });
const best = gazetteer.resolve('madras'); // Chennai, IN
```

`loadGazetteerFromDirectory` accepts a path or a `file:` URL. Browser and worker apps use `openGazetteerFromUrls(manifestUrl, placesUrl)`, or `Gazetteer.open(manifest, places, createFetchShardLoader(manifest, baseUrl))` for custom loading.

Any product that displays atlas results must show the GeoNames attribution (`ATTRIBUTION_TEXT`, or `manifest.attribution`).
