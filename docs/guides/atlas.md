# Atlas (`@node-jhora/atlas`)

`@node-jhora/atlas` is an offline city gazetteer for birth-place lookup. It is built from the GeoNames `cities1000`, `admin1CodesASCII`, `alternateNamesV2`, and `timeZones` dumps and returns latitude, longitude, IANA timezone, country, admin-1 region, and population for each place. Every cities1000 record is kept; the build does not apply a further population cut.

## Attribution (CC-BY 4.0)

Data © [GeoNames](https://www.geonames.org/), used under [Creative Commons Attribution 4.0 International (CC-BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

The compiled gazetteer shards are a derivative work of the GeoNames dumps. Any application that shows atlas results must display this attribution. It is exported as `ATTRIBUTION_TEXT`, written into every built `manifest.json` as `attribution`, and shipped in the package as `ATTRIBUTION.md` (`@node-jhora/atlas/attribution`).

## Data distribution

The npm package ships compiled code only (`dist/`, `README.md`, `ATTRIBUTION.md`, `LICENSE`), in line with [ADR-0006](../decisions/0006-npm-packaging-and-ephemeris-data-distribution.md). The generated data is not committed and not published. A full build is gzip-compressed JSON, one shard per 2-letter prefix, and each shard contains the place records that prefix needs. `shardBytes` on the manifest is the file size used as a load-progress denominator. Individual files stay at or under 100 MB and the tree stays well under 1 GB so the site can be published on GitHub Pages. The atlas is exhaustive and is expected to exceed 25 MB; the build does not warn for that. Build it with:

```bash
pnpm --filter @node-jhora/atlas atlas:build
```

The build downloads the GeoNames dumps into `packages/atlas/.cache/` and writes `packages/atlas/data/`. Serve that directory as a static asset or copy it next to your application.

## Search and normalization

- Keys are NFD-decomposed, folded, recomposed (NFC), lower-cased, and whitespace-collapsed. Combining diacritics used by Latin, Greek, and Cyrillic, and Hebrew and Arabic vowel points, are folded, so `koln`, `Köln`, and `KÖLN` match.
- Indic vowel signs and viramas, Thai vowels, and Japanese kana voicing marks are letters, not accents, and are kept. `बैरूत` (Beirut) and `बेरात` (Berat), or `ながの` (Nagano) and `なかの` (Nakano), remain distinct.
- Results are ranked in tiers: a primary or ASCII name prefix, then a later word of that name, then an alternate name only when fewer than eight hits came from the first two tiers. Within a tier, higher population wins, then the lower GeoNames id. `resolve('london')` returns London, GB. `resolve('bombay')` returns Mumbai. A place whose primary name is Madras outranks Chennai's historic alias.
- Latin alternate names are kept when GeoNames marks them preferred or short. Historic and colloquial Latin names are kept for places with population over 100,000 (Madras, Bombay). Unflagged transliterations are left out. Indic-script names are kept.

## Usage

```typescript
import { loadGazetteerFromDirectory } from '@node-jhora/atlas/node';

const gazetteer = await loadGazetteerFromDirectory(new URL('./data', import.meta.url));
const hits = gazetteer.search('chen', { limit: 5 });
const chennai = gazetteer.resolve('चेन्नई');
```

In a browser or worker, load `manifest.json` and pass `createFetchShardLoader` to `Gazetteer.open` with an empty preload list. The loader fetches one gzip shard for the query prefix and inflates it. Pass an empty place array when the manifest has no `places` file. The web client streams that response with a `ReadableStream` reader, reports percent from `shardBytes` or `Content-Length`, and prefetches the other shards at idle priority into the Cache API (`node-jhora-atlas-<builtAt>`).
