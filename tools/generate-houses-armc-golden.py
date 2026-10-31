#!/usr/bin/env python3
"""Generate pyswisseph houses_armc geometry fixtures (tests only — not imported by src)."""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

import swisseph as swe

# SE house letters used by node-jhora; J/Z are not implemented house systems.
LETTERS_HOUSE = [
    c for c in "ABCDEFGHIKLMNOPQRSTUVWXY" if c not in ("J", "Z")
] + ["i"]
EPS_DEFAULT = 23.439291
OUT = Path(__file__).resolve().parents[1] / "packages/core/tests/fixtures/houses_armc_pyswisseph.json"


def sun_declination_deg(lon_deg: float, eps: float) -> float:
    lam = math.radians(lon_deg)
    e = math.radians(eps)
    return math.degrees(math.asin(math.sin(lam) * math.sin(e)))


def main() -> int:
    random.seed(20261031)
    cases: list[dict] = []
    per_letter = 40
    for letter in LETTERS_HOUSE:
        hsys = letter.encode() if letter != "i" else b"i"
        n = 0
        attempts = 0
        while n < per_letter and attempts < per_letter * 50:
            attempts += 1
            armc = random.uniform(0.0, 360.0)
            lat = random.uniform(-60.0, 60.0)
            if abs(lat) < 0.5:
                continue
            eps = EPS_DEFAULT
            sun_lon: float | None = None
            sun_dec: float | None = None
            if letter in ("I", "i"):
                sun_lon = random.uniform(0.0, 360.0)
                sun_dec = sun_declination_deg(sun_lon, eps)
            try:
                if letter in ("I", "i"):
                    assert sun_dec is not None
                    cusps, ascmc, _, _ = swe.houses_armc_ex2(armc, lat, eps, hsys, sun_dec)
                else:
                    cusps, ascmc = swe.houses_armc(armc, lat, eps, hsys)
            except swe.Error:
                continue
            cusps = list(cusps)
            if letter == "G" and len(cusps) != 36:
                continue
            if letter != "G" and len(cusps) != 12:
                continue
            cases.append(
                {
                    "letter": letter,
                    "armc": armc,
                    "lat": lat,
                    "eps": eps,
                    "sunDeclination": sun_dec,
                    "sunEclipticLongitude": sun_lon,
                    "cusps": cusps,
                    "asc": ascmc[0],
                    "mc": ascmc[1],
                }
            )
            n += 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "meta": {
                    "oracle": "pyswisseph 2.10.03 houses_armc / houses_armc_ex2",
                    "toleranceArcsec": 0.001,
                    "nonPolarLatMax": 60,
                },
                "cases": cases,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(cases)} cases to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
