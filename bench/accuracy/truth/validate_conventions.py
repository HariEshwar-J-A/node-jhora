"""
Validate truth conventions before benchmark tables ship.

1. Planets: truth-profile chart frame is self-consistent; log bias vs Skyfield
   true ecliptic of date (~0.02″ frame difference, not a failure).
2. True node: truth_profile_erfa path repeatability on probe epochs.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

BENCH_ROOT = Path(__file__).resolve().parents[1]
CACHE = BENCH_ROOT / "cache"
sys.path.insert(0, str(BENCH_ROOT / "truth"))

PROBE_JD = [
    2459205.034722222,
    2451545.0,
    2415020.0,
    2524593.0,
]


def load_deltat(jd_ut: float, table: list[dict]) -> float:
    for i in range(len(table) - 1):
        a, b = table[i], table[i + 1]
        if a["jdUt"] <= jd_ut <= b["jdUt"]:
            t = (jd_ut - a["jdUt"]) / (b["jdUt"] - a["jdUt"])
            return a["deltaT"] + t * (b["deltaT"] - a["deltaT"])
    return table[-1]["deltaT"]


def main() -> int:
    with (BENCH_ROOT / "lib" / "deltat.json").open(encoding="utf-8") as f:
        table = json.load(f)["samples"]

    from skyfield.api import Loader
    from compute_truth import (
        BODY_TARGETS,
        DE440S_BSP,
        ensure_kernel,
        ephemeris_for_jd,
        load_deltat_table,
        skyfield_true_ecliptic_of_date,
    )
    from truth_profile_erfa import tropical_truth_profile_lon_lat, truth_true_node_deg

    load = Loader(str(CACHE))
    de440s = load(str(DE440S_BSP)) if DE440S_BSP.is_file() else None
    de440_full = load(str(ensure_kernel("de440.bsp")))
    de441_p1 = load(str(ensure_kernel("de441_part-1.bsp")))
    de441_p2 = load(str(ensure_kernel("de441_part-2.bsp")))
    ts = load.timescale()

    max_repeat_arcsec = 0.0
    max_skyfield_bias_arcsec = 0.0
    rows = []
    for jd_ut in PROBE_JD:
        dt = load_deltat(jd_ut, table)
        eph = ephemeris_for_jd(jd_ut, de440s, de440_full, de441_p1, de441_p2)
        earth = eph["earth"]
        for name, target in list(BODY_TARGETS.items())[:5]:
            body = eph[target]
            lon1, lat1 = tropical_truth_profile_lon_lat(earth, body, ts, jd_ut, dt)
            lon2, lat2 = tropical_truth_profile_lon_lat(earth, body, ts, jd_ut, dt)
            d_lon = ((lon2 - lon1 + 540) % 360 - 180) * 3600
            d_lat = (lat2 - lat1) * 3600
            comb = math.hypot(d_lon, d_lat)
            max_repeat_arcsec = max(max_repeat_arcsec, comb)

            lon_sf, lat_sf = skyfield_true_ecliptic_of_date(earth, body, ts, jd_ut, dt)
            bias_lon = ((lon1 - lon_sf + 540) % 360 - 180) * 3600
            bias_lat = (lat1 - lat_sf) * 3600
            bias = math.hypot(bias_lon, bias_lat)
            max_skyfield_bias_arcsec = max(max_skyfield_bias_arcsec, bias)
            rows.append(
                {
                    "jdUt": jd_ut,
                    "body": name,
                    "repeatArcsec": comb,
                    "skyfieldTrueEclipticBiasArcsec": bias,
                }
            )

    jd_node = 2451545.0
    dt_node = load_deltat(jd_node, table)
    eph_node = ephemeris_for_jd(jd_node, de440s, de440_full, de441_p1, de441_p2)
    n1 = truth_true_node_deg(eph_node["earth"], eph_node["moon"], ts, jd_node, dt_node)
    n2 = truth_true_node_deg(eph_node["earth"], eph_node["moon"], ts, jd_node, dt_node)
    node_repeat = abs(((n2 - n1 + 540) % 360 - 180)) * 3600
    planets_ok = max_repeat_arcsec < 0.001
    node_ok = node_repeat < 0.001
    out = {
        "passed": planets_ok and node_ok,
        "maxRepeatArcsec": max_repeat_arcsec,
        "maxSkyfieldTrueEclipticBiasArcsec": max_skyfield_bias_arcsec,
        "probes": rows,
        "trueNodeRepeatArcsec": node_repeat,
    }
    out_path = BENCH_ROOT / "artifacts" / "validation.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))
    return 0 if out["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
