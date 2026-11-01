#!/usr/bin/env python3
"""J2000 TT sanity gate for cross-library benchmark adapters."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

BENCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BENCH_ROOT / "truth"))
sys.path.insert(0, str(BENCH_ROOT / "lib"))

from compute_truth import delta_t_seconds, ensure_kernel, load_deltat_table  # noqa: E402

J2000_JD_UT = 2451545.0
FLG_JPLEPH = 1
FLG_SPEED = 256


def load_truth_sun_lon() -> float:
    p = BENCH_ROOT / "artifacts/truth.json"
    if not p.exists():
        raise SystemExit("truth.json missing — run compute_truth.py first")
    doc = json.loads(p.read_text(encoding="utf-8"))
    best = None
    best_d = 1e9
    for row in doc.get("truth", []):
        if row.get("body") != "Sun" or row.get("error"):
            continue
        d = abs(float(row.get("jdUt", 0)) - J2000_JD_UT)
        if d < best_d:
            best_d = d
            best = row
    if best is not None and best_d <= 30.0:
        return float(best["tropicalTrue"]["lon"])
    from skyfield.api import Loader
    from compute_truth import BODY_TARGETS, delta_t_seconds, ensure_kernel, load_deltat_table

    table = load_deltat_table()
    dt = delta_t_seconds(J2000_JD_UT, table)
    load = Loader(str(BENCH_ROOT / "cache"))
    de440 = load(str(ensure_kernel("de440.bsp")))
    ts = load.timescale()
    jd_tt = J2000_JD_UT + dt / 86400.0
    t = ts.tt_jd(jd_tt)
    lat, lon, _ = de440["earth"].at(t).observe(de440["sun"]).apparent().ecliptic_latlon(epoch="date")
    return float(lon.degrees) % 360.0


def delta_deg(a: float, b: float) -> float:
    d = (a - b + 540.0) % 360.0 - 180.0
    return abs(d)


def check_pyswisseph(truth_lon: float, dt: float) -> None:
    import swisseph as swe

    de440 = ensure_kernel("de440.bsp")
    swe.set_ephe_path(str(BENCH_ROOT / "cache"))
    swe.set_jpl_file(str(de440))
    swe.set_delta_t_userdef(dt)
    jd_tt = J2000_JD_UT + dt / 86400.0
    xx, _ = swe.calc(jd_tt, swe.SUN, FLG_JPLEPH | FLG_SPEED)
    err = delta_deg(xx[0] % 360.0, truth_lon) * 3600.0
    if err > 1.0:
        raise SystemExit(
            f"pyswisseph J2000 TT Sun residual {err:.3f}″ (expected <1″); "
            f"got λ={xx[0]:.6f}° truth={truth_lon:.6f}° jd_tt={jd_tt}"
        )


def check_astronomy_engine(truth_lon: float, dt: float) -> None:
    import subprocess

    script = BENCH_ROOT / "adapters/sanity_ae.mjs"
    r = subprocess.run(
        ["node", str(script), str(J2000_JD_UT), str(dt), str(truth_lon)],
        cwd=str(BENCH_ROOT),
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise SystemExit(r.stderr or r.stdout or "astronomy-engine sanity failed")


def main() -> int:
    table = load_deltat_table()
    dt = delta_t_seconds(J2000_JD_UT, table)
    truth_lon = load_truth_sun_lon()
    check_pyswisseph(truth_lon, dt)
    check_astronomy_engine(truth_lon, dt)
    out = {
        "jdUt": J2000_JD_UT,
        "deltaTSeconds": dt,
        "truthSunLonDeg": truth_lon,
        "status": "ok",
    }
    (BENCH_ROOT / "artifacts/competitor_sanity.json").write_text(
        json.dumps(out, indent=2) + "\n",
        encoding="utf-8",
    )
    print("Competitor J2000 TT sanity: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
