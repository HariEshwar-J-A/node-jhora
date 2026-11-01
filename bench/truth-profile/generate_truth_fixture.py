#!/usr/bin/env python3
"""Generate truth-profile golden fixture from DE440s + ERFA (bench-only)."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import erfa  # noqa: E402
import numpy as np  # noqa: E402

BENCH_ROOT = Path(__file__).resolve().parents[1] / "accuracy"
sys.path.insert(0, str(BENCH_ROOT / "truth"))
sys.path.insert(0, str(BENCH_ROOT / "lib"))

from compute_truth import delta_t_seconds, load_deltat_table  # noqa: E402
from true_node_truth import nutation_dpsi_deg  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "packages/core/tests/fixtures/truth_profile_erfa.json"
DE440S_BSP = ROOT / "packages/ephe/de440s.bsp"

CASES = [
    {"id": "y1850_jul02", "jdUt": 2396753.0},
    {"id": "y1875_jul01", "jdUt": 2405887.5},
    {"id": "y1900_jul01", "jdUt": 2415021.5},
    {"id": "y1925_jul01", "jdUt": 2424156.5},
    {"id": "y1950_jul01", "jdUt": 2433290.5},
    {"id": "j2000_noon", "jdUt": 2451545.0},
    {"id": "y2025_jul01", "jdUt": 2460690.5},
    {"id": "y2050_jul01", "jdUt": 2469824.5},
    {"id": "y2075_jul01", "jdUt": 2478959.5},
    {"id": "y2100_jul01", "jdUt": 2488093.5},
    {"id": "y2125_jul01", "jdUt": 2497228.5},
    {"id": "y2149_dec31", "jdUt": 2506352.0},
]

C_KM_S = 299792.458


def split_jd_tdb(jd_tdb: float) -> tuple[float, float]:
    d = math.floor(jd_tdb)
    return d, jd_tdb - d


def subtract_tau_from_tdb_parts(d: float, f: float, tau_days: float) -> tuple[float, float]:
    f_prime = f - tau_days
    d_prime = d
    while f_prime < 0:
        f_prime += 1.0
        d_prime -= 1.0
    while f_prime >= 1.0:
        f_prime -= 1.0
        d_prime += 1.0
    return d_prime, f_prime


def jd_tt_parts(jd_tt: float) -> tuple[float, float]:
    return 2451545.0, jd_tt - 2451545.0


def jd_tdb_from_tt(jd_tt: float) -> float:
    d1, d2 = jd_tt_parts(jd_tt)
    return jd_tt + float(erfa.dtdb(d1, d2, 0.0, 0.0, 0.0, 0.0)) / 86400.0


def ecliptic_lon_lat(u: np.ndarray) -> tuple[float, float]:
    lon = math.degrees(math.atan2(u[1], u[0])) % 360.0
    lat = math.degrees(math.atan2(u[2], math.hypot(u[1], u[0])))
    return lon, lat


def chart_ecliptic_from_icrf_km(km: np.ndarray, jd_tt: float) -> tuple[float, float]:
    u = km / np.linalg.norm(km)
    d1, d2 = jd_tt_parts(jd_tt)
    m = erfa.ecm06(d1, d2)
    lon_m, lat = ecliptic_lon_lat(m @ u)
    lon = (lon_m + nutation_dpsi_deg(jd_tt)) % 360.0
    return lon, lat


def ascending_node_lon(pos: np.ndarray, vel: np.ndarray) -> float:
    hx = pos[1] * vel[2] - pos[2] * vel[1]
    hy = pos[2] * vel[0] - pos[0] * vel[2]
    return math.degrees(math.atan2(hx, -hy)) % 360.0


def truth_true_node_deg(earth, moon, ts, jd_ut: float, dt: float) -> float:
    jd_tt_r = jd_ut + dt / 86400.0
    jd_tdb_r = jd_tdb_from_tt(jd_tt_r)
    d_r, f_r = split_jd_tdb(jd_tdb_r)
    t_r = ts.tdb_jd(d_r, f_r)
    r0 = np.asarray((moon.at(t_r) - earth.at(t_r)).position.km, dtype=float)
    tau = float(np.linalg.norm(r0)) / C_KM_S / 86400.0
    d_m, f_m = subtract_tau_from_tdb_parts(d_r, f_r, tau)
    t_m = ts.tdb_jd(d_m, f_m)
    r = np.asarray((moon.at(t_m) - earth.at(t_r)).position.km, dtype=float)
    v = np.asarray((moon.at(t_m) - earth.at(t_r)).velocity.km_per_s, dtype=float) * 86400.0
    d1, d2 = jd_tt_parts(jd_tt_r)
    m = erfa.ecm06(d1, d2)
    re = m @ r
    ve = m @ v
    lon = ascending_node_lon(re, ve)
    return (lon + nutation_dpsi_deg(jd_tt_r)) % 360.0


def main() -> int:
    from skyfield.api import Loader

    if not DE440S_BSP.is_file():
        raise SystemExit(f"Missing pinned kernel: {DE440S_BSP}")

    table = load_deltat_table()
    load = Loader(str(BENCH_ROOT / "cache"))
    de440 = load(str(DE440S_BSP))
    ts = load.timescale()
    earth = de440["earth"]
    moon = de440["moon"]
    sun = de440["sun"]
    pluto = de440["pluto barycenter"]

    out = []
    for c in CASES:
        jd_ut = c["jdUt"]
        dt = delta_t_seconds(jd_ut, table)
        jd_tt = jd_ut + dt / 86400.0
        jd_tdb = jd_tdb_from_tt(jd_tt)
        d_tdb, f_tdb = split_jd_tdb(jd_tdb)
        t = ts.tdb_jd(d_tdb, f_tdb)
        bodies = {}
        for name, body in (("Sun", sun), ("Moon", moon), ("Pluto", pluto)):
            km = np.asarray(earth.at(t).observe(body).apparent().position.km, dtype=float)
            lon, lat = chart_ecliptic_from_icrf_km(km, jd_tt)
            bodies[name] = {"lon": lon, "lat": lat}

        mean_node = math.degrees(erfa.faom03((jd_tt - 2451545.0) / 36525.0)) % 360.0
        true_node = truth_true_node_deg(earth, moon, ts, jd_ut, dt)
        d1, d2 = jd_tt_parts(jd_tt)
        ut1 = 2451545.0
        ut2 = jd_ut - ut1
        gast = math.degrees(erfa.gst06a(ut1, ut2, d1, d2)) % 360.0

        out.append(
            {
                "id": c["id"],
                "jdUt": jd_ut,
                "deltaTSeconds": dt,
                "bodies": bodies,
                "meanNodeDeg": mean_node,
                "trueNodeDeg": true_node,
                "gastDeg": gast,
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "description": "ERFA+DE440s truth-profile oracle (generated; bench-only tool)",
                "generator": "bench/truth-profile/generate_truth_fixture.py",
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
