# @node-jhora/atlas

Offline city gazetteer built from GeoNames (`cities1000`, admin codes, timezones, and alternate names). Supports prefix search with diacritic folding (Latin, Greek, Cyrillic accents; Hebrew and Arabic vowel points) and resolves aliases such as Chennai, Madras, and `चेन्नई` to the same record. Indic vowel signs and viramas, Thai vowels, and kana voicing marks are kept, so `बैरूत` (Beirut) and `बेरात` (Berat) or `ながの` (Nagano) and `なかの` (Nakano) stay distinct.

Results are ranked in tiers: a primary or ASCII name prefix, then a later word of that name, then an alternate name only when fewer than eight hits came from the first two tiers. Within a tier, higher population wins, then the lower GeoNames id. `resolve('london')` returns London, GB. `resolve('bombay')` returns Mumbai, because no primary name is Bombay. A town named Madras outranks Chennai's historic alias.

## Data

- **Source:** GeoNames (CC-BY 4.0). See [ATTRIBUTION.md](./ATTRIBUTION.md).
- **Build:** `pnpm --filter @node-jhora/atlas atlas:build` downloads upstream dumps into `.cache/` (not committed) and writes `data/`.
- **Layout:** each `index/la-xx.json.gz` file is one 2-letter prefix and holds the place records that prefix needs. There is no global `places.json`. `manifest.shardBytes` records each file's size. The build keeps every cities1000 place (no extra population cut). A file must stay at or under 100 MB and the tree well under 1 GB, which is the GitHub Pages limit. Passing 25 MB is expected.
- **Tests** use a tiny fixture under `tests/fixtures/gazetteer-mini/` so CI does not download GeoNames.

Generated `data/` is **not** committed. CI uses `tests/fixtures/gazetteer-mini/`. For production, run `atlas:build` in your pipeline or ship the `data/` directory as a static asset.

## Usage

```typescript
import { loadGazetteerFromDirectory } from '@node-jhora/atlas/node';

const gazetteer = await loadGazetteerFromDirectory(new URL('./data', import.meta.url));
const hits = gazetteer.search('chennai', { limit: 5 });
const best = gazetteer.resolve('bombay'); // Mumbai, IN
```

`loadGazetteerFromDirectory` accepts a path or a `file:` URL and reads plain or gzip JSON shards. Browser and worker apps use `Gazetteer.open(manifest, places, createFetchShardLoader(manifest, baseUrl))`. Pass an empty `places` array and an empty preload list when `manifest.places` is omitted, then `ensureShard` for the one prefix a query needs. `openGazetteerFromUrls(manifestUrl, placesUrl)` still loads a global place table for older builds. The web app streams that shard (progress from `shardBytes` or `Content-Length`), prefetches the rest at idle into the Cache API, and keeps the field read-only with a percent label until the bytes it needs have arrived.

Any product that displays atlas results must show the GeoNames attribution (`ATTRIBUTION_TEXT`, or `manifest.attribution`).
