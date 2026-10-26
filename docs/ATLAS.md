# Atlas (`@node-jhora/atlas`)

`@node-jhora/atlas` is an offline city gazetteer for birth-place lookup. It is built from the GeoNames `cities1000`, `admin1CodesASCII`, `alternateNamesV2`, and `timeZones` dumps and returns latitude, longitude, IANA timezone, country, admin-1 region, and population for each place.

## Attribution (CC-BY 4.0)

Data © [GeoNames](https://www.geonames.org/), used under [Creative Commons Attribution 4.0 International (CC-BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

The compiled gazetteer shards are a derivative work of the GeoNames dumps. Any application that shows atlas results must display this attribution. It is exported as `ATTRIBUTION_TEXT`, written into every built `manifest.json` as `attribution`, and shipped in the package as `ATTRIBUTION.md` (`@node-jhora/atlas/attribution`).

## Data distribution

The npm package ships compiled code only (`dist/`, `README.md`, `ATTRIBUTION.md`, `LICENSE`), in line with [ADR-0006](./decisions/0006-npm-packaging-and-ephemeris-data-distribution.md). The generated data (about 28 MB of sharded JSON) is not committed and not published. Build it with:

```bash
pnpm --filter @node-jhora/atlas atlas:build
```

The build downloads the GeoNames dumps into `packages/atlas/.cache/` and writes `packages/atlas/data/`. Serve that directory as a static asset or copy it next to your application.

## Search and normalization

- Keys are NFD-decomposed, folded, recomposed (NFC), lower-cased, and whitespace-collapsed. Combining diacritics used by Latin, Greek, and Cyrillic, and Hebrew and Arabic vowel points, are folded, so `koln`, `Köln`, and `KÖLN` match.
- Indic vowel signs and viramas, Thai vowels, and Japanese kana voicing marks are letters, not accents, and are kept. `बैरूत` (Beirut) and `बेरात` (Berat), or `ながの` (Nagano) and `なかの` (Nakano), remain distinct.
- Results are ranked exact match first, then by population (descending), then by GeoNames id. `resolve('london')` returns London, GB; `resolve('madras')` returns Chennai, IN.

## Usage

```typescript
import { loadGazetteerFromDirectory } from '@node-jhora/atlas/node';

const gazetteer = await loadGazetteerFromDirectory(new URL('./data', import.meta.url));
const hits = gazetteer.search('chen', { limit: 5 });
const chennai = gazetteer.resolve('चेन्नई');
```

In a browser or worker, use `openGazetteerFromUrls(manifestUrl, placesUrl)` from `@node-jhora/atlas`.
