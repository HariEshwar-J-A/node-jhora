"""
Validate truth conventions before benchmark tables ship.

1. Planets: Skyfield apparent true ecliptic vs ERFA pnm06a+nut06a (< 1 mas).
2. True node: independent DE state agreement + dual rotation routes (logged).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import erfa
import numpy as np

BENCH_ROOT = Path(__file__).resolve().parents[1]
CACHE = BENCH_ROOT / "cache"
sys.path.insert(0, str(BENCH_ROOT / "truth"))

PROBE_JD = [
    2451545.0,
    2451545.0,
    2415020.0,
    2524593.0,
]


def _jd_split(jd_tt: float) -> tuple[float, float]:
    return 2400000.5, jd_tt - 2400000.5


def load_deltat(jd_ut: float, table: list[dict]) -> float:
    for i in range(len(table) - 1):
        a, b = table[i], table[i + 1]
        if a["jdUt"] <= jd_ut <= b["jdUt"]:
            t = (jd_ut - a["jdUt"]) / (b["jdUt"] - a["jdUt"])
            return a["deltaT"] + t * (b["deltaT"] - a["deltaT"])
    return table[-1]["deltaT"]


def erfa_true_ecliptic_deg(jd_ut: float, delta_t: float, icrf_unit: np.ndarray) -> tuple[float, float]:
    jd_tt = jd_ut + delta_t / 86400.0
    d1, d2 = _jd_split(jd_tt)
    v = erfa.pnm06a(d1, d2) @ icrf_unit
    _dpsi, deps = erfa.nut06a(d1, d2)
    epsa = float(erfa.obl06(d1, d2) + deps)
    x, y, z = v
    xe = x
    ye = y * math.cos(epsa) + z * math.sin(epsa)
    ze = -y * math.sin(epsa) + z * math.cos(epsa)
    lon = math.degrees(math.atan2(ye, xe)) % 360.0
    lat = math.degrees(math.atan2(ze, math.hypot(xe, ye)))
    return lon, lat


def _validate_true_node(table: list[dict], earth, moon, ts) -> dict:
    from true_node_truth import (
        cross_check_mean_ecliptic_routes,
        true_node_tn_med,
    )

    jd_ut = 2451545.0
    dt = load_deltat(jd_ut, table)
    cross = cross_check_mean_ecliptic_routes(earth, moon, ts, jd_ut, dt)
    lon1, _, _ = true_node_tn_med(earth, moon, ts, jd_ut, dt, light_time_retardation=True)
    lon2, _, _ = true_node_tn_med(earth, moon, ts, jd_ut, dt, light_time_retardation=True)
    repeat_arcsec = abs(((lon2 - lon1 + 540) % 360 - 180)) * 3600
    state_ok = cross["moonStateAgreementArcsec"] < 0.001
    repeat_ok = repeat_arcsec < 1e-6
    erfa_routes_ok = abs(cross["dErfaEcm06VsBp06Arcsec"]) < 0.001
    sky_apparent_ok = abs(cross["dSkyfieldTrueEclipticVsApparentTnMedArcsec"]) < 0.001
    return {
        **cross,
        "trueNodeApparentDeg": lon1,
        "repeatArcsec": repeat_arcsec,
        "passedStateSubMas": state_ok,
        "passedRepeatSubMas": repeat_ok,
        "passedErfaRoutesSubMas": erfa_routes_ok,
        "passedSkyfieldTrueVsApparentSubMas": sky_apparent_ok,
        "passed": state_ok and repeat_ok and erfa_routes_ok,
    }


def main() -> int:
    with (BENCH_ROOT / "lib" / "deltat.json").open(encoding="utf-8") as f:
        table = json.load(f)["samples"]

    from skyfield.api import Loader
    from compute_truth import BODY_TARGETS, ensure_kernel, ephemeris_for_jd

    load = Loader(str(CACHE))
    de440 = load(str(ensure_kernel("de440.bsp")))
    de441_p1 = load(str(ensure_kernel("de441_part-1.bsp")))
    de441_p2 = load(str(ensure_kernel("de441_part-2.bsp")))
    ts = load.timescale()

    max_arcsec = 0.0
    rows = []
    for jd_ut in PROBE_JD:
        dt = load_deltat(jd_ut, table)
        eph = ephemeris_for_jd(jd_ut, de440, de441_p1, de441_p2)
        earth = eph["earth"]
        t = ts.tt_jd(jd_ut + dt / 86400.0)
        for name, target in list(BODY_TARGETS.items())[:5]:
            lat, lon, _ = earth.at(t).observe(eph[target]).apparent().ecliptic_latlon(epoch="date")
            lon_sf, lat_sf = lon.degrees % 360.0, lat.degrees
            u = np.array(earth.at(t).observe(eph[target]).apparent().position.km, dtype=float)
            u = u / np.linalg.norm(u)
            lon_erfa, lat_erfa = erfa_true_ecliptic_deg(jd_ut, dt, u)
            d_lon = ((lon_erfa - lon_sf + 540) % 360 - 180) * 3600
            d_lat = (lat_erfa - lat_sf) * 3600
            comb = math.hypot(d_lon, d_lat)
            max_arcsec = max(max_arcsec, comb)
            rows.append(
                {
                    "jdUt": jd_ut,
                    "body": name,
                    "dLonArcsec": d_lon,
                    "dLatArcsec": d_lat,
                    "combinedArcsec": comb,
                }
            )

    planets_ok = max_arcsec < 0.001
    jd_node = 2451545.0
    dt_node = load_deltat(jd_node, table)
    eph_node = ephemeris_for_jd(jd_node, de440, de441_p1, de441_p2)
    node_probe = _validate_true_node(
        table, eph_node["earth"], eph_node["moon"], ts
    )
    out = {
        "passed": planets_ok and node_probe["passed"],
        "maxCombinedArcsec": max_arcsec,
        "probes": rows,
        "trueNodeValidation": node_probe,
    }
    out_path = BENCH_ROOT / "artifacts" / "validation.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))
    return 0 if out["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
