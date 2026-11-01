#!/usr/bin/env python3
"""Generate truth deep-era golden fixture (pyerfa + DE441 Python reference)."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import erfa
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "packages/core/tests/fixtures/truth_deep_era.json"

J0 = 2305448.0
J1 = 2524594.0
J2000 = 2451545.0

# Kernel TT edges (sync with packages/core chunk-coverage.ts)
NJCE_TT_JD_MIN = -1_931_440.605_619_693
NJCE_TT_JD_MAX = 5_373_856.151_148_088
DRACONIC_D = 6798.383
HALF_WINDOW_JD = 250 * 365.25

STEP2_PROBES = [
    {"id": "y_minus_3000", "jdUt": 625674.0, "deltaTSeconds": 64200.0},
    {"id": "y_minus_7500", "jdUt": 168453.5, "deltaTSeconds": 64200.0},
    {"id": "y_plus_5000", "jdUt": 2087130.5, "deltaTSeconds": 64200.0},
    {"id": "y_minus_500", "jdUt": 1927130.5, "deltaTSeconds": 60.0},
]

DE441_PROBE_YEARS = [
    -10000,
    -7500,
    -5000,
    -3000,
    -1000,
    5500,
    7500,
    10000,
]


def jdtt_to_t(jdtt: float) -> float:
    return (jdtt - J2000) / 36525.0


def jdtt_to_epj(jdtt: float) -> float:
    return 2000.0 + (jdtt - J2000) / 365.25


def jdtt_from_proleptic_year(year: float) -> float:
    return J2000 + (year - 2000.0) * 365.25


def vondrak_pole_obliquity_deg(jdtt: float) -> float:
    epj = jdtt_to_epj(jdtt)
    peqr = np.asarray(erfa.ltpequ(epj), dtype=float)
    pecl = np.asarray(erfa.ltpecl(epj), dtype=float)
    dot = float(np.clip(np.dot(peqr, pecl), -1.0, 1.0))
    return math.degrees(math.acos(dot))


def era_ltecm_lon_deg(jdtt: float) -> float:
    epj = jdtt_to_epj(jdtt)
    r = np.asarray(erfa.ltecm(epj), dtype=float)
    p = np.array([1.0, 0.0, 0.0])
    v = r @ p
    return math.degrees(math.atan2(v[1], v[0])) % 360.0


def faom03_deg(jdtt: float) -> float:
    t = jdtt_to_t(jdtt)
    return math.degrees(erfa.faom03(t)) % 360.0


def main() -> None:
    cases = []
    for p in STEP2_PROBES:
        jdtt = p["jdUt"] + p["deltaTSeconds"] / 86400.0
        in_iau = J0 <= jdtt <= J1
        entry = {
            "id": p["id"],
            "jdUt": p["jdUt"],
            "deltaTSeconds": p["deltaTSeconds"],
            "jdTT": jdtt,
            "inIau2006Window": in_iau,
            "poleObliquityDeg": vondrak_pole_obliquity_deg(jdtt),
            "faom03MeanNodeDeg": faom03_deg(jdtt),
        }
        if not in_iau:
            entry["icrfEquinoxLonDeg"] = era_ltecm_lon_deg(jdtt)
        cases.append(entry)

    sys.path.insert(0, str(Path(__file__).parent))
    import de441_mean_node_reference as ref  # noqa: E402

    de441_entries: list[dict] = []
    edge_probes = [
        ("kernel_tt_min", NJCE_TT_JD_MIN + 50.0),
        ("kernel_tt_max", NJCE_TT_JD_MAX - 50.0),
    ]

    for year in DE441_PROBE_YEARS:
        jdtt = jdtt_from_proleptic_year(float(year))
        node = ref.secular_mean_node_deg(jdtt)
        if node is None:
            print(f"WARN: no DE441 node for year {year}", file=sys.stderr)
            continue
        eid = f"y_minus_{abs(year)}" if year < 0 else f"y_plus_{year}"
        entry: dict = {
            "id": eid,
            "prolepticYear": year,
            "jdTT": jdtt,
            "meanNodeDeg": node,
            "faom03MeanNodeDeg": faom03_deg(jdtt),
        }
        if ref.secular_window_clipped(jdtt):
            entry["secularWindowClipped"] = True
        de441_entries.append(entry)

    for eid, jdtt in edge_probes:
        node = ref.secular_mean_node_deg(jdtt)
        if node is None:
            print(f"WARN: no DE441 node for {eid}", file=sys.stderr)
            continue
        entry = {
            "id": eid,
            "prolepticYear": 2000 + (jdtt - J2000) / 365.25,
            "jdTT": jdtt,
            "meanNodeDeg": node,
            "faom03MeanNodeDeg": faom03_deg(jdtt),
        }
        if ref.secular_window_clipped(jdtt):
            entry["secularWindowClipped"] = True
        de441_entries.append(entry)

    doc = {
        "description": "Truth deep-era oracle (pyerfa + independent DE441 BSP reference)",
        "generator": "bench/truth-profile/generate_deep_era_fixture.py",
        "toleranceArcsec": 0.0001,
        "nodeToleranceArcsec": 0.001,
        "cases": cases,
        "de441MeanNode": de441_entries,
        "faom03WindowYears": [-500, 5000],
    }

    OUT.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(cases)} step-2 cases, {len(de441_entries)} DE441 nodes)")


if __name__ == "__main__":
    main()
