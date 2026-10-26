# GeoNames attribution

Place data in this package is derived from [GeoNames](https://www.geonames.org/) export files:

- `cities1000.zip` — cities with population ≥ 1,000
- `admin1CodesASCII.txt` — first-level administrative divisions
- `alternateNamesV2.zip` — alternate and historic names (including Indic scripts)
- `timeZones.txt` — IANA timezone reference

**License:** [Creative Commons Attribution 4.0 International (CC-BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

**Required attribution (CC-BY 4.0):**  
Data © [GeoNames](https://www.geonames.org/), used under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The compiled gazetteer shards (`data/`) are a derivative work of the above GeoNames dumps. Rebuild with `pnpm --filter @node-jhora/atlas atlas:build` after updating the build script or source dumps.
