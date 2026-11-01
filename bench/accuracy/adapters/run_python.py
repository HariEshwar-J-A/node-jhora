#!/usr/bin/env python3
"""Black-box Python library adapters (public pip APIs only)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

BENCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BENCH_ROOT / "truth"))
sys.path.insert(0, str(BENCH_ROOT / "lib"))

from frame_bridge import lahiri_iae_ayanamsa_deg  # noqa: E402

FLG_JPLEPH = 1
FLG_SPEED = 256


def load_deltat(jd_ut: float, table: list[dict]) -> float:
    if jd_ut <= table[0]["jdUt"]:
        return table[0]["deltaT"]
    if jd_ut >= table[-1]["jdUt"]:
        return table[-1]["deltaT"]
    for i in range(len(table) - 1):
        a, b = table[i], table[i + 1]
        if a["jdUt"] <= jd_ut <= b["jdUt"]:
            t = (jd_ut - a["jdUt"]) / (b["jdUt"] - a["jdUt"])
            return a["deltaT"] + t * (b["deltaT"] - a["deltaT"])
    return table[-1]["deltaT"]


def swisseph_rows(jd_ut: float, shared_dt: float | None, deltat_table: list[dict]) -> list[dict]:
    import swisseph as swe

    swe.set_ephe_path(str(BENCH_ROOT / "cache"))
    de440 = BENCH_ROOT / "cache" / "de440.bsp"
    if de440.exists():
        swe.set_jpl_file(str(de440))
    if shared_dt is not None:
        swe.set_delta_t_userdef(shared_dt)
    flags = FLG_JPLEPH | FLG_SPEED
    bodies = [
        ("Sun", swe.SUN),
        ("Moon", swe.MOON),
        ("Mercury", swe.MERCURY),
        ("Venus", swe.VENUS),
        ("Mars", swe.MARS),
        ("Jupiter", swe.JUPITER),
        ("Saturn", swe.SATURN),
        ("Uranus", swe.URANUS),
        ("Neptune", swe.NEPTUNE),
        ("Pluto", swe.PLUTO),
        ("MeanNode", swe.MEAN_NODE),
        ("TrueNode", swe.TRUE_NODE),
    ]
    dt_used = shared_dt if shared_dt is not None else load_deltat(jd_ut, deltat_table)
    jd_tt = jd_ut + dt_used / 86400.0
    ayan = lahiri_iae_ayanamsa_deg(jd_ut)
    rows = []
    for name, bid in bodies:
        xx, _ = swe.calc(jd_tt, bid, flags)
        trop_lon, trop_lat = xx[0] % 360.0, xx[1]
        rows.append(
            {
                "jdUt": jd_ut,
                "body": name,
                "library": "pyswisseph",
                "deltaTMode": "shared" if shared_dt is not None else "native",
                "tropicalTrue": {"lon": trop_lon, "lat": trop_lat},
                "lahiriIae": {"lon": (trop_lon - ayan) % 360.0, "lat": trop_lat},
            }
        )
    return rows


def skyfield_rows(jd_ut: float, de440, de441_p1, de441_p2, ts, deltat_table) -> list[dict]:
    from compute_truth import compute_epoch, ephemeris_for_jd
    import frame_bridge as fb

    eph = ephemeris_for_jd(jd_ut, de440, de441_p1, de441_p2)
    earth = eph["earth"]
    rows = []
    for row in compute_epoch(jd_ut, de440, de441_p1, de441_p2, ts, earth, deltat_table, fb):
        rows.append(
            {
                "jdUt": row["jdUt"],
                "body": row["body"],
                "library": "skyfield",
                "deltaTMode": "shared",
                "tropicalTrue": row["tropicalTrue"],
                "lahiriIae": row["lahiriIae"],
            }
        )
    return rows


def main() -> int:
    epochs_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    mode = sys.argv[3] if len(sys.argv) > 3 else "shared"

    with epochs_path.open(encoding="utf-8") as f:
        epochs = json.load(f)
    with (BENCH_ROOT / "lib" / "deltat.json").open(encoding="utf-8") as f:
        deltat_table = json.load(f)["samples"]

    from skyfield.api import Loader
    from compute_truth import ensure_kernel

    load = Loader(str(BENCH_ROOT / "cache"))
    de440 = load(str(ensure_kernel("de440.bsp")))
    de441_p1 = load(str(ensure_kernel("de441_part-1.bsp")))
    de441_p2 = load(str(ensure_kernel("de441_part-2.bsp")))
    ts = load.timescale()

    rows: list[dict] = []
    for entry in epochs:
        jd = float(entry["jdUt"])
        shared = load_deltat(jd, deltat_table) if mode == "shared" else None
        try:
            rows.extend(swisseph_rows(jd, shared, deltat_table))
        except Exception as exc:  # noqa: BLE001
            rows.append({"jdUt": jd, "library": "pyswisseph", "error": str(exc)})
        try:
            rows.extend(skyfield_rows(jd, de440, de441_p1, de441_p2, ts, deltat_table))
        except Exception as exc:  # noqa: BLE001
            rows.append({"jdUt": jd, "library": "skyfield", "error": str(exc)})

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"deltaTMode": mode, "samples": rows}, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
