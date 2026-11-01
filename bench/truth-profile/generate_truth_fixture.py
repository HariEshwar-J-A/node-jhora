#!/usr/bin/env python3
"""Generate truth-profile golden fixture from DE440s + ERFA (bench-only)."""

from __future__ import annotations

import json
import math
import struct
import sys
from pathlib import Path

import erfa  # noqa: E402
import numpy as np  # noqa: E402

BENCH_ROOT = Path(__file__).resolve().parents[1] / "accuracy"
sys.path.insert(0, str(BENCH_ROOT / "truth"))
sys.path.insert(0, str(BENCH_ROOT / "lib"))

from compute_truth import delta_t_seconds, load_deltat_table  # noqa: E402
from truth_profile_erfa import (  # noqa: E402
    mean_node_longitude_deg,
    tropical_truth_profile_lon_lat,
    truth_true_node_deg,
    true_obliquity_deg,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "packages/core/tests/fixtures/truth_profile_erfa.json"
DE440S_BSP = ROOT / "packages/ephe/de440s.bsp"
EOP_BIN = ROOT / "packages/eop/eop.bin"

CHENNAI = {"lat": 13.0827, "lon": 80.2707}
H_SPEED = 1.0 / 86400.0
J2000 = 2451545.0

CASES = [
    {"id": "y1850_jul02", "jdUt": 2396753.0},
    {"id": "y1875_jul01", "jdUt": 2405887.5},
    {"id": "y1900_jul01", "jdUt": 2415021.5},
    {"id": "y1925_jul01", "jdUt": 2424156.5},
    {"id": "y1950_jul01", "jdUt": 2433290.5},
    {"id": "j2000_noon", "jdUt": 2451545.0},
    {"id": "y2020_jan15", "jdUt": 2458863.5},
    {"id": "y2025_jul01", "jdUt": 2460690.5},
    {"id": "y2050_jul01", "jdUt": 2469824.5},
    {"id": "y2075_jul01", "jdUt": 2478959.5},
    {"id": "y2100_jul01", "jdUt": 2488093.5},
    {"id": "y2125_jul01", "jdUt": 2497228.5},
    {"id": "y2149_dec31", "jdUt": 2506352.0},
    {"id": "y2069_neptune_grid", "jdUt": 2469029.3936170214},
]


def load_eop_table(path: Path):
    data = path.read_bytes()
    magic, ver, mjd_start, count = struct.unpack_from("<IIfI", data, 0)
    if magic != 0x4E4A454F or ver != 1:
        raise SystemExit("bad eop.bin header")
    o = 80
    rows = []
    for i in range(count):
        ut1_us, xp_mas, yp_mas = struct.unpack_from("<ihh", data, o)
        rows.append((mjd_start + i, ut1_us / 1e6, xp_mas / 1000.0, yp_mas / 1000.0))
        o += 8
    return rows


def lookup_eop(jd_ut: float, rows: list[tuple[float, float, float, float]]):
    mjd = jd_ut - 2400000.5
    if mjd < rows[0][0] or mjd > rows[-1][0]:
        return 0.0, 0.0, 0.0, False
    i1 = min(int(mjd - rows[0][0]), len(rows) - 2)
    mjd0, u0, x0, y0 = rows[i1]
    mjd1, u1, x1, y1 = rows[i1 + 1]
    t = (mjd - mjd0) / (mjd1 - mjd0) if mjd1 > mjd0 else 0.0
    ut1 = u0 + t * (u1 - u0)
    xp = x0 + t * (x1 - x0)
    yp = y0 + t * (y1 - y0)
    return ut1, xp, yp, True


def compute_mc_deg(ramc_deg: float, eps_deg: float) -> float:
    r = math.radians(ramc_deg)
    e = math.radians(eps_deg)
    return math.degrees(math.atan2(math.sin(r), math.cos(r) * math.cos(e))) % 360.0


def gast_deg(jd_ut: float, dt: float, ut1_utc: float) -> float:
    jd_tt = jd_ut + dt / 86400.0
    d1, d2 = J2000, jd_tt - J2000
    jd_ut1 = jd_ut + ut1_utc / 86400.0
    return math.degrees(erfa.gst06a(J2000, jd_ut1 - J2000, d1, d2)) % 360.0


def compute_ascendant_deg(
    ramc_deg: float,
    lat_deg: float,
    eps_deg: float,
    xp_arcsec: float,
    yp_arcsec: float,
) -> float:
    pole_clamp = 89.999999
    r = math.radians(ramc_deg)
    e = math.radians(eps_deg)
    lat = max(-pole_clamp, min(pole_clamp, lat_deg))
    l = math.radians(lat)
    asc = math.degrees(
        math.atan2(math.cos(r), -(math.sin(e) * math.tan(l) + math.cos(e) * math.sin(r))),
    ) % 360.0
    if abs(lat_deg) > 90.0 - eps_deg:
        lam = math.radians(asc)
        ra = math.degrees(math.atan2(math.sin(lam) * math.cos(e), math.cos(lam))) % 360.0
        if math.sin(math.radians(ramc_deg - ra)) > 0:
            asc = (asc + 180) % 360.0
    lam = math.radians(asc)
    cos_phi = math.cos(math.radians(lat_deg))
    if abs(cos_phi) > 1e-8:
        dlam = (
            math.radians(xp_arcsec / 3600.0) * math.sin(lam)
            - math.radians(yp_arcsec / 3600.0) * math.cos(lam)
        ) / cos_phi
        asc = (asc + math.degrees(dlam)) % 360.0
    return asc


def unwrap_rate(l1: float, l0: float) -> float:
    d = l1 - l0
    if d > 180:
        d -= 360
    if d < -180:
        d += 360
    return d


def speed_deg_per_day(lon_fn, jd_ut: float, dt: float) -> float:
    h = H_SPEED
    l0 = lon_fn(jd_ut - h)
    l1 = lon_fn(jd_ut + h)
    return unwrap_rate(l1, l0) / (2 * h)


def main() -> int:
    from skyfield.api import Loader

    if not DE440S_BSP.is_file():
        raise SystemExit(f"Missing pinned kernel: {DE440S_BSP}")
    if not EOP_BIN.is_file():
        raise SystemExit(f"Missing {EOP_BIN} — run pnpm --filter @node-jhora/eop run pack-data")

    eop_rows = load_eop_table(EOP_BIN)
    table = load_deltat_table()
    load = Loader(str(BENCH_ROOT / "cache"))
    de440 = load(str(DE440S_BSP))
    ts = load.timescale()
    earth = de440["earth"]
    moon = de440["moon"]
    sun = de440["sun"]
    pluto = de440["pluto barycenter"]
    jupiter = de440["jupiter barycenter"]
    saturn = de440["saturn barycenter"]
    neptune = de440["neptune barycenter"]

    out = []
    for c in CASES:
        jd_ut = c["jdUt"]
        dt = delta_t_seconds(jd_ut, table)
        ut1_utc, xp, yp, _ = lookup_eop(jd_ut, eop_rows)
        jd_tt = jd_ut + dt / 86400.0

        bodies = {}
        targets = (("Sun", sun), ("Moon", moon), ("Pluto", pluto))
        if c["id"] == "y2069_neptune_grid":
            targets = (*targets, ("Neptune", neptune))

        def lon_lat(name, body):
            return tropical_truth_profile_lon_lat(
                earth,
                body,
                ts,
                jd_ut,
                dt,
                sun=sun,
                jupiter=jupiter,
                saturn=saturn,
            )

        for name, body in targets:
            lon, lat = lon_lat(name, body)
            bodies[name] = {"lon": lon, "lat": lat}

        def sun_lon(ju):
            dti = delta_t_seconds(ju, table)
            return tropical_truth_profile_lon_lat(
                earth, sun, ts, ju, dti, sun=sun, jupiter=jupiter, saturn=saturn
            )[0]

        def moon_lon(ju):
            dti = delta_t_seconds(ju, table)
            return tropical_truth_profile_lon_lat(
                earth, moon, ts, ju, dti, sun=sun, jupiter=jupiter, saturn=saturn
            )[0]

        mean_node = mean_node_longitude_deg(jd_tt)
        true_node = truth_true_node_deg(earth, moon, ts, jd_ut, dt)
        gast = gast_deg(jd_ut, dt, ut1_utc)
        eps = true_obliquity_deg(jd_tt)
        ramc = (gast + CHENNAI["lon"]) % 360.0
        chennai_asc = compute_ascendant_deg(ramc, CHENNAI["lat"], eps, xp, yp)
        chennai_mc = compute_mc_deg(ramc, eps)

        out.append(
            {
                "id": c["id"],
                "jdUt": jd_ut,
                "deltaTSeconds": dt,
                "bodies": bodies,
                "meanNodeDeg": mean_node,
                "trueNodeDeg": true_node,
                "gastDeg": gast,
                "chennaiAscDeg": chennai_asc,
                "chennaiMcDeg": chennai_mc,
                "speedsDegPerDay": {
                    "Sun": speed_deg_per_day(sun_lon, jd_ut, dt),
                    "Moon": speed_deg_per_day(moon_lon, jd_ut, dt),
                },
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "description": "ERFA+DE440s truth-profile oracle (generated; bench-only tool)",
                "generator": "bench/truth-profile/generate_truth_fixture.py",
                "toleranceArcsec": 0.0001,
                "cases": out,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT} ({len(out)} cases)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
