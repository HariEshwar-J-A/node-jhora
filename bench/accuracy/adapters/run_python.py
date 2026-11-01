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

FLG_ECLIPTIC = 4
FLG_JPLEPH = 1


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
    if shared_dt is not None:
        swe.set_delta_t_userdef(shared_dt)
    flags = FLG_JPLEPH | FLG_ECLIPTIC
    bodies = [
        ("Sun", 0),
        ("Moon", 1),
        ("Mercury", 2),
        ("Venus", 3),
        ("Mars", 4),
        ("Jupiter", 5),
        ("Saturn", 6),
        ("Uranus", 7),
        ("Neptune", 8),
        ("Pluto", 9),
        ("MeanNode", 10),
        ("TrueNode", 11),
    ]
    dt_used = shared_dt if shared_dt is not None else load_deltat(jd_ut, deltat_table)
    ayan = lahiri_iae_ayanamsa_deg(jd_ut)
    rows = []
    for name, bid in bodies:
        xx, _ = swe.calc_ut(jd_ut, bid, flags)
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
    from compute_truth import BODY_TARGETS, compute_epoch, ephemeris_for_jd
    import frame_bridge as fb

    dt = load_deltat(jd_ut, deltat_table)
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
        if mode == "shared":
            try:
                rows.extend(skyfield_rows(jd, de440, de441_p1, de441_p2, ts, deltat_table))
            except Exception as exc:  # noqa: BLE001
                rows.append({"jdUt": jd, "library": "skyfield", "error": str(exc)})

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump({"samples": rows, "deltaTMode": mode}, f, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
