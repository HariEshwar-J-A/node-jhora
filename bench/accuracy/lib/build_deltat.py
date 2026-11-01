"""
Build shared ΔT(UT) samples for the bench (seconds).

Primary model: Espenak & Meeus polynomial segments for historical eras and
NASA/Goddard published values for modern dates, exported to JSON so every
library can be run with identical ΔT (see ADR 0024).
"""

from __future__ import annotations

import json
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent / "deltat.json"


def espenak_meeus_delta_t(year: float) -> float:
    """ΔT in seconds (Espenak & Meeus polynomial segments, public domain)."""
    y = year
    if y < -500:
        u = (y - 1820) / 100
        return -20 + 32 * u * u
    if y < 500:
        u = y / 100
        return (
            10583.6
            - 1014.41 * u
            + 33.78311 * u**2
            - 5.952053 * u**3
            - 0.1798452 * u**4
            + 0.022174192 * u**5
            + 0.0090319521 * u**6
        )
    if y < 1600:
        u = (y - 1000) / 100
        return (
            1574.2
            - 556.01 * u
            + 71.23472 * u**2
            + 0.319781 * u**3
            - 0.8503463 * u**4
            - 0.005050998 * u**5
            + 0.0083572073 * u**6
        )
    if y < 1700:
        t = y - 1600
        return 120 - 0.9808 * t - 0.01532 * t**2 + t**3 / 7129
    if y < 1800:
        t = y - 1700
        return 8.83 + 0.1603 * t - 0.0059285 * t**2 + 0.00013336 * t**3 - t**4 / 1174000
    if y < 1860:
        t = y - 1800
        return (
            13.72
            - 0.332447 * t
            + 0.0068612 * t**2
            + 0.0041116 * t**3
            - 0.00037436 * t**4
            + 0.0000121272 * t**5
            - 0.0000001699 * t**6
            + 0.000000000875 * t**7
        )
    if y < 1900:
        t = y - 1860
        return 7.62 + 0.5737 * t - 0.251754 * t**2 + 0.01680668 * t**3 - 0.0004473624 * t**4 + t**5 / 233174
    if y < 1920:
        t = y - 1900
        return -2.79 + 1.494119 * t - 0.0598939 * t**2 + 0.0061966 * t**3 - 0.000197 * t**4
    if y < 1941:
        t = y - 1920
        return 21.2 + 0.84493 * t - 0.0761 * t**2 + 0.0020936 * t**3
    if y < 1961:
        t = y - 1950
        return 29.07 + 0.407 * t - t**2 / 233 + t**3 / 2547
    if y < 1986:
        t = y - 1975
        return 45.45 + 1.067 * t - t**2 / 260 - t**3 / 718
    if y < 2005:
        t = y - 2000
        return 63.86 + 0.3345 * t - 0.060374 * t**2 + 0.0017275 * t**3 + 0.000651814 * t**4 + 0.00002373599 * t**5
    if y < 2050:
        t = y - 2000
        return 62.92 + 0.32217 * t + 0.005589 * t**2
    if y < 2150:
        return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y)
    u = (y - 1820) / 100
    return -20 + 32 * u * u


def jd_to_gregorian_year(jd_ut: float) -> float:
    z = int(jd_ut + 0.5)
    f = jd_ut + 0.5 - z
    if z < 2299161:
        a = z
    else:
        alpha = int((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha - int(alpha / 4)
    b = a + 1524
    c = int((b - 122.1) / 365.25)
    d = int(365.25 * c)
    e = int((b - d) / 30.6001)
    day = b - d - int(30.6001 * e) + f
    month = e - 1 if e < 14 else e - 13
    year = c - 4716 if month > 2 else c - 4715
    return year + (month - 1) / 12 + (day - 1) / 365


def build_table() -> dict:
    # Coarse anchor points every 50 years from -8000 to +8000, plus denser modern grid.
    years = list(range(-8000, 8001, 50)) + list(range(1840, 2061, 1))
    years = sorted(set(years))
    samples = []
    for y in years:
        jd = 2451545.0 + (y - 2000) * 365.2425
        samples.append({"year": y, "jdUt": jd, "deltaT": espenak_meeus_delta_t(y)})
    return {"model": "espenak_meeus_shared", "samples": samples}


def main() -> None:
    OUT.write_text(json.dumps(build_table(), indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
