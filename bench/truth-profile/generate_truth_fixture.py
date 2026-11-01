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
from truth_profile_erfa import (  # noqa: E402
    chart_ecliptic_from_icrf_km,
    jd_tdb_from_tt,
    mean_node_longitude_deg,
    split_jd_tdb,
    truth_true_node_deg,
)

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
    {"id": "y2069_neptune_grid", "jdUt": 2469029.3936170214},
]


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

    neptune = de440["neptune barycenter"]

    out = []
    for c in CASES:
        jd_ut = c["jdUt"]
        dt = delta_t_seconds(jd_ut, table)
        jd_tt = jd_ut + dt / 86400.0
        jd_tdb = jd_tdb_from_tt(jd_tt)
        d_tdb, f_tdb = split_jd_tdb(jd_tdb)
        t = ts.tdb_jd(d_tdb, f_tdb)
        bodies = {}
        targets = (("Sun", sun), ("Moon", moon), ("Pluto", pluto))
        if c["id"] == "y2069_neptune_grid":
            targets = (*targets, ("Neptune", neptune))
        for name, body in targets:
            km = np.asarray(earth.at(t).observe(body).apparent().position.km, dtype=float)
            lon, lat = chart_ecliptic_from_icrf_km(km, jd_tt)
            bodies[name] = {"lon": lon, "lat": lat}

        mean_node = mean_node_longitude_deg(jd_tt)
        true_node = truth_true_node_deg(earth, moon, ts, jd_ut, dt)
        d1, d2 = 2451545.0, jd_tt - 2451545.0
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
