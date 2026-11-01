"""
Independent DE440/DE441 truth: Skyfield apparent places on NAIF kernels.

Primary tropical output: true equator and ecliptic of date (matches Skyfield
`ecliptic_latlon(epoch='date')`). Validated against ERFA to < 1 mas before use.

Chart / Lahiri IAE helpers call bench Node CLIs that reuse production Vondrák
2011 + CRC 1955 Lahiri definition code (bench-only; not shipped).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

BENCH_ROOT = Path(__file__).resolve().parents[1]
CACHE = BENCH_ROOT / "cache"
sys.path.insert(0, str(BENCH_ROOT / "truth"))
sys.path.insert(0, str(BENCH_ROOT / "lib"))

from frame_bridge import lahiri_iae_ayanamsa_deg  # noqa: E402
from nodes import mean_node_longitude_deg  # noqa: E402
from true_node_truth import true_node_tn_med  # noqa: E402

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


def ephemeris_for_jd(jd_ut: float, de440, de441_p1, de441_p2):
    which = kernel_for_jd(jd_ut)
    if which == "de440":
        return de440
    if which == "de441_part1":
        return de441_p1
    return de441_p2


def _jd_split(jd_tt: float) -> tuple[float, float]:
    return 2400000.5, jd_tt - 2400000.5


def nutation_dpsi_deg(jd_ut: float, delta_t: float) -> float:
    import erfa

    jd_tt = jd_ut + delta_t / 86400.0
    d1, d2 = _jd_split(jd_tt)
    dpsi, _deps = erfa.nut06a(d1, d2)
    return math.degrees(dpsi)


def compute_epoch(
    jd_ut: float,
    de440,
    de441_p1,
    de441_p2,
    ts,
    earth,
    deltat_table,
    frame_bridge,
) -> list[dict]:
    dt = delta_t_seconds(jd_ut, deltat_table)
    tt_jd = jd_ut + dt / 86400.0
    t = ts.tt_jd(tt_jd)
    which = kernel_for_jd(jd_ut)
    eph = ephemeris_for_jd(jd_ut, de440, de441_p1, de441_p2)
    ayan_iae = lahiri_iae_ayanamsa_deg(jd_ut)

    rows: list[dict] = []
    for name, target in BODY_TARGETS.items():
        body = eph[target]
        lat, lon, _ = earth.at(t).observe(body).apparent().ecliptic_latlon(epoch="date")
        trop_lon = lon.degrees % 360.0
        trop_lat = lat.degrees
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

    mean_lon = mean_node_longitude_deg(tt_jd)
    lon_lt, lon_mean, dpsi_deg = true_node_tn_med(
        earth,
        eph["moon"],
        ts,
        jd_ut,
        dt,
        light_time_retardation=True,
    )
    lon_inst, _, _ = true_node_tn_med(
        earth,
        eph["moon"],
        ts,
        jd_ut,
        dt,
        light_time_retardation=False,
    )
    for label, trop, extra in (
        ("MeanNode", mean_lon, {}),
        (
            "TrueNode",
            lon_lt,
            {
                "trueNodeConvention": "TN-MED-LT1",
                "trueNodeMeanEclipticDeg": lon_mean,
                "trueNodeDpsiArcsec": dpsi_deg * 3600.0,
                "trueNodeInstantDeg": lon_inst,
            },
        ),
    ):
        rows.append(
            {
                "jdUt": jd_ut,
                "body": label,
                "kernel": which,
                "deltaTSeconds": dt,
                "tropicalTrue": {"lon": trop, "lat": 0.0},
                "lahiriIae": {"lon": (trop - ayan_iae) % 360.0, "lat": 0.0},
                **extra,
            }
        )
    return rows


def main() -> int:
    epochs_path = Path(sys.argv[1]) if len(sys.argv) > 1 else BENCH_ROOT / "artifacts" / "epochs.json"
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else BENCH_ROOT / "artifacts" / "truth.json"

    import frame_bridge as fb

    with epochs_path.open(encoding="utf-8") as f:
        epochs = json.load(f)

    deltat_table = load_deltat_table()
    from skyfield.api import Loader

    load = Loader(str(CACHE))
    de440 = load(str(ensure_kernel("de440.bsp")))
    de441_p1 = load(str(ensure_kernel("de441_part-1.bsp")))
    de441_p2 = load(str(ensure_kernel("de441_part-2.bsp")))
    ts = load.timescale()

    all_rows: list[dict] = []
    errors: list[dict] = []
    for entry in epochs:
        jd = float(entry["jdUt"])
        try:
            earth = ephemeris_for_jd(jd, de440, de441_p1, de441_p2)["earth"]
            all_rows.extend(
                compute_epoch(jd, de440, de441_p1, de441_p2, ts, earth, deltat_table, fb)
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
                        "ephemeris": "JPL DE440 (1550–2650 CE UT) / DE441 parts otherwise",
                        "time": "UT + shared ΔT → TT; SPK via Skyfield timescale",
                        "place": "Skyfield apparent (light-time, deflection, aberration)",
                        "tropicalTrue": "true equator/ecliptic of date (IAU 2006/2000A via ERFA in Skyfield)",
                        "lahiriIae": "tropicalTrue − Lahiri (CRC 1955 / Bhatnagar 1990 IAE, modern profile)",
                        "meanNode": "Meeus eq. 47.7 (Chapront-Touzé & Chapront 1991)",
                        "trueNode": "TN-MED-LT1: Skyfield DE geocentric Moon (no .apparent), one-shot LT, ERFA mean ecliptic + nut06a Δψ (true_node_truth.py)",
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
