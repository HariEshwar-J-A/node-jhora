# @node-jhora/eop — provenance

## finals2000A.all

- **Source:** IERS Earth Orientation Centre / USNO EOP Product Center
- **URL:** https://maia.usno.navy.mil/ser7/finals2000A.all (mirrors listed in `download.mjs`)
- **Format:** IERS Bulletin A `finals2000A` (see `readme.finals2000A` on the same site)
- **Columns used:** MJD (UTC), Bulletin A polar motion x/y (arcsec), Bulletin A UT1−UTC (seconds)
- **License:** IERS data are public; cite the IERS Conventions (2010) and acknowledge IERS / USNO.

## leap-seconds.list

- **Source:** IANA Time Zone Database
- **URL:** https://data.iana.org/time-zones/data/leap-seconds.list
- **Use:** SHA-256 pin and provenance only; leap-second history is already embedded in `@node-jhora/core` modern ΔT.
- **License:** Public domain (IANA).

## Packed file `eop.bin`

Built by `build-pack.mjs` from the pinned downloads. SHA-256 of sources is stored in the binary header.
