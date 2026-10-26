#!/usr/bin/env python3
"""Sample Swiss Ephemeris as the numeric oracle for the True Citra golden file.

Writes packages/core/tests/fixtures/se_golden.json. The engine implements the
same quantities from published formulas; this script only records what
pyswisseph 2.10 returns so the test can demand < 1″.

Requires:
  pyswisseph, and a JPL ephemeris SE can open. DE440 (the same integration the
  engine reads as de440s.bsp) is preferred:

      # little-endian JPL binary, renamed the way SE expects
      curl -o /tmp/seph/de440.eph \\
        https://ssd.jpl.nasa.gov/ftp/eph/planets/Linux/de440/linux_p1550p2650.440

  sepl_18.se1 / semo_18.se1 in the ephemeris path are the fallback (DE431).
  Over 1850–2150 those differ from DE440 by ≤ 0.06″.

Usage:
  python3 tools/generate-se-golden.py
  SE_EPHE_PATH=/tmp/seph SE_JPL_FILE=de440.eph python3 tools/generate-se-golden.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import swisseph as swe

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "packages" / "core" / "tests" / "fixtures" / "se_golden.json"

EPHE = os.environ.get("SE_EPHE_PATH", "/tmp/seph")
JPL = os.environ.get("SE_JPL_FILE", "de440.eph")

# id, Y, M, D, h, min, s, latitude, longitude (east-positive)
CHARTS = [
    ("grafton-2026",       2026, 10, 25,  3, 27, 22,  42 + 12 / 60 + 10 / 3600, -(71 + 41 / 60 + 10 / 3600)),
    ("delhi-1947",         1947,  8, 14, 18, 30,  0,  28 + 40 / 60,              77 + 13 / 60),
    ("sample-2000-1200",  2000, 1,  1,  12, 0,  0,  51.4769,                    -0.0005),
    ("kolkata-1875",       1875,  3,  1,  0,  7,  0,  22.5667,                    88.3667),
    ("london-2100",        2100,  6, 21, 12,  0,  0,  51.5,                      -0.1167),
    ("sample-2000-1200",  2000, 1,  1,  12, 0,  0,  51.4769,                -0.0005),
    ("delhi-1850",         1850,  1,  1,  0,  0,  0,  28.6139,                    77.2090),
    ("sydney-1850",        1850,  6, 15, 18,  0,  0, -33.8688,                   151.2093),
    ("newyork-1862",       1862, 11,  9,  6,  0,  0,  40.7128,                   -74.0060),
    ("london-1888",        1888,  4, 12, 15, 30,  0,  51.5074,                    -0.1278),
    ("mumbai-1910",        1910,  1,  1,  0,  0,  0,  19.0760,                    72.8777),
    ("tokyo-1925",         1925,  8, 20,  4,  0,  0,  35.6762,                   139.6503),
    ("moscow-1936",        1936,  2, 29, 12,  0,  0,  55.7558,                    37.6173),
    ("chennai-1955",       1955,  7,  1,  0,  0,  0,  13.0827,                    80.2707),
    ("florida-1969",       1969,  7, 20, 20, 17,  0,  28.5383,                   -80.6000),
    ("reykjavik-1980",     1980,  1,  1, 12,  0,  0,  64.1466,                   -21.9426),
    # Spica is near the Sun in mid-October; deflection of the ayanamsa star peaks here.
    ("chennai-1990-spica", 1990, 10, 16, 18,  0,  0,  13.0827,                    80.2707),
    ("equator-2000",       2000,  1,  1, 12,  0,  0,   0.0,                        0.0),
    ("capetown-2012",      2012, 12, 21, 11, 12,  0, -33.9249,                    18.4241),
    ("rome-2024",          2024,  6, 15,  0,  0,  0,  41.9028,                    12.4964),
    ("paris-2049",         2049, 12, 31, 23,  0,  0,  48.8566,                     2.3522),
    ("paris-2050",         2050,  1,  1,  0,  0,  0,  48.8566,                     2.3522),
    ("buenosaires-2065",   2065,  3, 21,  6,  0,  0, -34.6037,                   -58.3816),
    ("singapore-2088",     2088,  9, 22, 18, 30,  0,   1.3521,                   103.8198),
    ("oslo-2120",          2120, 11,  3,  9,  0,  0,  59.9139,                    10.7522),
    ("beijing-2150",       2150,  1,  1,  0,  0,  0,  39.9042,                   116.4074),
]

BODIES = [
    ("Sun", swe.SUN), ("Moon", swe.MOON), ("Mercury", swe.MERCURY),
    ("Venus", swe.VENUS), ("Mars", swe.MARS), ("Jupiter", swe.JUPITER),
    ("Saturn", swe.SATURN),
]


def main() -> None:
    swe.set_ephe_path(EPHE)
    jpl_path = Path(EPHE) / JPL
    using_jpl = jpl_path.is_file()
    if using_jpl:
        swe.set_jpl_file(JPL)
    swe.set_sid_mode(swe.SIDM_TRUE_CITRA)

    base = swe.FLG_JPLEPH if using_jpl else swe.FLG_SWIEPH
    flags = base | swe.FLG_SIDEREAL | swe.FLG_TRUEPOS

    charts = []
    for spec in CHARTS:
        name, y, mo, d, h, mi, s, lat, lon = spec
        jd = swe.julday(y, mo, d, h + mi / 60 + s / 3600)
        sun, ret = swe.calc_ut(jd, swe.SUN, flags)
        if using_jpl and not (ret & swe.FLG_JPLEPH):
            raise SystemExit(f"{name}: SE did not use the JPL file (ret {ret})")

        planets = {}
        for bname, ipl in BODIES:
            xx, _ = swe.calc_ut(jd, ipl, flags)
            planets[bname] = xx[0]
        true_node, _ = swe.calc_ut(jd, swe.TRUE_NODE, flags)
        mean_node, _ = swe.calc_ut(jd, swe.MEAN_NODE, flags)

        houses = {}
        for hsys in (b"W", b"E", b"P", b"O"):
            cusps, ascmc = swe.houses_ex(jd, lat, lon, hsys, swe.FLG_SIDEREAL)
            houses[hsys.decode()] = {
                "ascendant": ascmc[0],
                "mc": ascmc[1],
                "armc": ascmc[2],
                "vertex": ascmc[3],
                "cusps": list(cusps),
            }

        charts.append({
            "id": name,
            "jd": jd,
            "utc": {"year": y, "month": mo, "day": d, "hour": h, "minute": mi, "second": s},
            "lat": lat,
            "lon": lon,
            "ayanamsa": swe.get_ayanamsa_ut(jd),
            "deltaT": swe.deltat(jd) * 86400.0,
            "planets": planets,
            "trueNode": true_node[0],
            "meanNode": mean_node[0],
            "houses": houses,
        })

    doc = {
        "provenance": {
            "oracle": f"pyswisseph {swe.version}",
            "ephemeris": (
                f"JPL DE440 via SEFLG_JPLEPH, file {JPL}"
                if using_jpl else
                "Swiss Ephemeris sepl_18.se1/semo_18.se1 (JPL DE431 compressed)"
            ),
            "tidalAccelerationArcsecPerCy2": swe.get_tid_acc(),
            "siderealMode": "SE_SIDM_TRUE_CITRA (27)",
            "planets": "FLG_SIDEREAL | FLG_TRUEPOS — geometric places, nutation off, True Citra",
            "nodes": "TRUE_NODE and MEAN_NODE with the same flags; Ketu = node + 180°",
            "ayanamsa": "swe.get_ayanamsa_ut — apparent Spica on the mean ecliptic, nutation excluded",
            "houses": "swe.houses_ex(FLG_SIDEREAL). ARMC is not shifted by ayanamsa.",
            "houseSystems": {"W": "Whole Sign", "E": "Equal", "P": "Placidus", "O": "Porphyry"},
            "toleranceArcsec": 1,
            "note": (
                "Sampled from the Swiss Ephemeris library as a numeric oracle. "
                "The engine implements these quantities from published formulas "
                "(IERS Conventions 2010, Capitaine et al. 2003, Stephenson / Morrison / "
                "Hohenkerk 2016, Stephenson 1997, the classical Placidus semi-arc). "
                "Swiss Ephemeris C source was not copied."
            ),
        },
        "charts": charts,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=2) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(charts)} charts, jpl={using_jpl})")


if __name__ == "__main__":
    main()
