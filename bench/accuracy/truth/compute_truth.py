"""
Independent DE440/DE441 truth for cross-library benchmark.

Primary tropical output (`tropicalTrue`): same published definition as
`packages/core/tests/fixtures/truth_profile_erfa.json` — geocentric apparent
on DE440/DE441, TDB (ERFA dtdb), two-part dates, mean ecliptic (ecm06) with
nut06a Δψ on longitude only (truth precision profile / ADR 0027).

Skyfield `.ecliptic_latlon(epoch='date')` is **not** the benchmark truth; it is
exposed only via the `skyfield` competitor adapter (true equator/ecliptic of date).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

BENCH_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BENCH_ROOT.parents[1]
CACHE = BENCH_ROOT / "cache"
DE440S_BSP = REPO_ROOT / "packages/ephe/de440s.bsp"
# @node-jhora/core de440s.bsp coverage (TDB JD band; UT epochs in bench align here)
DE440S_JD_UT_MIN = 2396752.5
DE440S_JD_UT_MAX = 2506352.5
sys.path.insert(0, str(BENCH_ROOT / "truth"))
sys.path.insert(0, str(BENCH_ROOT / "lib"))

from frame_bridge import lahiri_iae_ayanamsa_deg  # noqa: E402
from truth_profile_erfa import (  # noqa: E402
    mean_node_longitude_deg,
    tropical_truth_profile_lon_lat,
    truth_true_node_deg,
)

KERNEL_URLS = {
    "de440.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440.bsp",
    "de441_part-1.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-1.bsp",
    "de441_part-2.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-2.bsp",
}

DE440_JD_MIN = 2287187.5
DE440_JD_MAX = 2524593.5
DE441_SPLIT_JD = 2524686.5

BODY_TARGETS = {
    "Sun": "sun",
    "Moon": "moon",
    "Mercury": "mercury",
    "Venus": "venus",
    "Mars": "mars barycenter",
    "Jupiter": "jupiter barycenter",
    "Saturn": "saturn barycenter",
    "Uranus": "uranus barycenter",
    "Neptune": "neptune barycenter",
    "Pluto": "pluto barycenter",
}


def load_deltat_table() -> list[dict]:
    with (BENCH_ROOT / "lib" / "deltat.json").open(encoding="utf-8") as f:
        return json.load(f)["samples"]


def delta_t_seconds(jd_ut: float, table: list[dict]) -> float:
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


def ensure_kernel(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / name
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    from skyfield.iokit import download

    download(KERNEL_URLS[name], str(dest))
    return dest


def kernel_for_jd(jd_ut: float) -> str:
    if DE440_JD_MIN <= jd_ut <= DE440_JD_MAX:
        return "de440"
    if jd_ut < DE441_SPLIT_JD:
        return "de441_part1"
    return "de441_part2"


def ephemeris_for_jd(jd_ut: float, de440s, de440_full, de441_p1, de441_p2):
    which = kernel_for_jd(jd_ut)
    if which == "de440":
        if (
            de440s is not None
            and DE440S_JD_UT_MIN <= jd_ut <= DE440S_JD_UT_MAX
        ):
            return de440s
        return de440_full
    if which == "de441_part1":
        return de441_p1
    return de441_p2


def skyfield_true_ecliptic_of_date(
    earth,
    body,
    ts,
    jd_ut: float,
    dt: float,
) -> tuple[float, float]:
    """Competitor column: Skyfield apparent true ecliptic of date (TT timescale)."""
    tt_jd = jd_ut + dt / 86400.0
    t = ts.tt_jd(tt_jd)
    lat, lon, _ = earth.at(t).observe(body).apparent().ecliptic_latlon(epoch="date")
    return lon.degrees % 360.0, lat.degrees


def compute_epoch(
    jd_ut: float,
    de440s,
    de440_full,
    de441_p1,
    de441_p2,
    ts,
    earth,
    deltat_table,
    frame_bridge,
) -> list[dict]:
    dt = delta_t_seconds(jd_ut, deltat_table)
    which = kernel_for_jd(jd_ut)
    eph = ephemeris_for_jd(jd_ut, de440s, de440_full, de441_p1, de441_p2)
    ayan_iae = lahiri_iae_ayanamsa_deg(jd_ut)

    rows: list[dict] = []
    for name, target in BODY_TARGETS.items():
        body = eph[target]
        trop_lon, trop_lat = tropical_truth_profile_lon_lat(earth, body, ts, jd_ut, dt)
        rows.append(
            {
                "jdUt": jd_ut,
                "body": name,
                "kernel": which,
                "deltaTSeconds": dt,
                "tropicalTrue": {"lon": trop_lon, "lat": trop_lat},
                "lahiriIae": {
                    "lon": (trop_lon - ayan_iae) % 360.0,
                    "lat": trop_lat,
                },
            }
        )

    jd_tt = jd_ut + dt / 86400.0
    mean_lon = mean_node_longitude_deg(jd_tt)
    true_lon = truth_true_node_deg(earth, eph["moon"], ts, jd_ut, dt)
    for label, trop in (("MeanNode", mean_lon), ("TrueNode", true_lon)):
        rows.append(
            {
                "jdUt": jd_ut,
                "body": label,
                "kernel": which,
                "deltaTSeconds": dt,
                "tropicalTrue": {"lon": trop, "lat": 0.0},
                "lahiriIae": {"lon": (trop - ayan_iae) % 360.0, "lat": 0.0},
            }
        )
    return rows


def compute_skyfield_competitor_epoch(
    jd_ut: float,
    de440s,
    de440_full,
    de441_p1,
    de441_p2,
    ts,
    earth,
    deltat_table,
) -> list[dict]:
    """Rows for the `skyfield` library column (true ecliptic of date, not benchmark truth)."""
    dt = delta_t_seconds(jd_ut, deltat_table)
    which = kernel_for_jd(jd_ut)
    eph = ephemeris_for_jd(jd_ut, de440s, de440_full, de441_p1, de441_p2)
    ayan_iae = lahiri_iae_ayanamsa_deg(jd_ut)
    rows: list[dict] = []
    for name, target in BODY_TARGETS.items():
        body = eph[target]
        trop_lon, trop_lat = skyfield_true_ecliptic_of_date(earth, body, ts, jd_ut, dt)
        rows.append(
            {
                "jdUt": jd_ut,
                "body": name,
                "kernel": which,
                "tropicalTrue": {"lon": trop_lon, "lat": trop_lat},
                "lahiriIae": {
                    "lon": (trop_lon - ayan_iae) % 360.0,
                    "lat": trop_lat,
                },
            }
        )
    from nodes import mean_node_longitude_deg as meeus_mean_node

    tt_jd = jd_ut + dt / 86400.0
    mean_lon = meeus_mean_node(tt_jd)
    from true_node_truth import true_node_tn_med

    lon_lt, _, _ = true_node_tn_med(
        earth,
        eph["moon"],
        ts,
        jd_ut,
        dt,
        light_time_retardation=True,
    )
    for label, trop in (("MeanNode", mean_lon), ("TrueNode", lon_lt)):
        rows.append(
            {
                "jdUt": jd_ut,
                "body": label,
                "tropicalTrue": {"lon": trop % 360.0, "lat": 0.0},
                "lahiriIae": {"lon": (trop - ayan_iae) % 360.0, "lat": 0.0},
            }
        )
    return rows


def main() -> int:
    epochs_path = Path(sys.argv[1]) if len(sys.argv) > 1 else BENCH_ROOT / "artifacts" / "epochs.json"
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else BENCH_ROOT / "artifacts" / "truth.json"

    import frame_bridge as fb  # noqa: F401

    with epochs_path.open(encoding="utf-8") as f:
        epochs = json.load(f)

    deltat_table = load_deltat_table()
    from skyfield.api import Loader

    load = Loader(str(CACHE))
    de440s = load(str(DE440S_BSP)) if DE440S_BSP.is_file() else None
    de440_full = load(str(ensure_kernel("de440.bsp")))
    de441_p1 = load(str(ensure_kernel("de441_part-1.bsp")))
    de441_p2 = load(str(ensure_kernel("de441_part-2.bsp")))
    ts = load.timescale()

    all_rows: list[dict] = []
    errors: list[dict] = []
    for entry in epochs:
        jd = float(entry["jdUt"])
        try:
            earth = ephemeris_for_jd(jd, de440s, de440_full, de441_p1, de441_p2)["earth"]
            all_rows.extend(
                compute_epoch(
                    jd, de440s, de440_full, de441_p1, de441_p2, ts, earth, deltat_table, fb
                )
            )
        except Exception as exc:  # noqa: BLE001
            errors.append({"jdUt": jd, "error": str(exc)})

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {
                    "generator": "compute_truth.py",
                    "conventions": {
                        "ephemeris": "JPL DE440s.bsp (1550–2650 CE UT, same kernel as @node-jhora/core) / DE441 parts otherwise",
                        "time": "UT + shared Espenak–Meeus ΔT → TT; SPK evaluation in TDB (ERFA dtdb); two-part TDB dates",
                        "place": "Skyfield apparent (light-time, deflection, aberration)",
                        "tropicalTrue": "Mean ecliptic (ERFA ecm06) + nut06a Δψ on λ only; matches truth_profile_erfa.json / ADR 0027",
                        "lahiriIae": "tropicalTrue − Lahiri (CRC 1955 / Bhatnagar 1990 IAE, modern profile)",
                        "meanNode": "ERFA faom03 (IAU 2006 polynomial)",
                        "trueNode": "DE440/441 geocentric Moon with one-shot light-time; ecm06 node + nut06a Δψ (truth_profile_erfa.py)",
                        "skyfieldCompetitor": "Separate adapter column: Skyfield true ecliptic of date (epoch='date')",
                    },
                    "errors": errors,
                },
                "truth": all_rows,
            },
            f,
            indent=2,
        )
    print(f"Wrote {out_path} ({len(all_rows)} rows, {len(errors)} errors)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
