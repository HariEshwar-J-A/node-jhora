#!/usr/bin/env python3
"""
Generate rise/set/transit golden cases using Swiss Ephemeris (pyswisseph).

Oracle numbers only — not shipped; AGPL Swiss Ephemeris runs locally in CI/dev.
Provenance: source=pyswisseph, toolVersion from swe.version.
"""

from __future__ import annotations

import hashlib
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import swisseph as swe

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "packages/core/tests/fixtures/riseset.golden.json"

BODIES = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
}

EVENTS = {
    "rise": swe.CALC_RISE,
    "set": swe.CALC_SET,
    "upperTransit": swe.CALC_MTRANSIT,
    "lowerTransit": swe.CALC_ITRANSIT,
}

JD_UT_STEP = 0.01 / 86400.0  # 0.01 s in Julian days


def canonical_json(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def settings_hash(settings: dict) -> str:
    return hashlib.sha256(canonical_json(settings).encode()).hexdigest()


def round_jd_ut(jd: float) -> float:
    return round(jd / JD_UT_STEP) * JD_UT_STEP


def se_ephe_flags(settings: dict) -> int:
    """Ephemeris and geometric-place flags passed to the oracle."""
    return swe.FLG_SWIEPH | swe.FLG_TRUEPOS


def se_rsmi_base(settings: dict) -> int:
    """Rise/set bits are OR'd into the `rsmi` argument, not `flags`."""
    bits = 0
    if settings.get("limb") == "disc_centre":
        bits |= swe.BIT_DISC_CENTER
    else:
        bits |= swe.BIT_DISC_BOTTOM
    if not settings.get("refraction"):
        bits |= swe.BIT_NO_REFRACTION
    return bits


def compute_event(
    jd_start: float,
    body: int,
    rsmi: int,
    geopos: list[float],
    ephe_flags: int,
    rsmi_bits: int,
    atpress: float,
    attemp: float,
) -> tuple[str, float | None]:
    try:
        res, tret = swe.rise_trans(
            jd_start,
            body,
            rsmi | rsmi_bits,
            geopos,
            atpress=atpress,
            attemp=attemp,
            flags=ephe_flags,
        )
    except swe.Error:
        return "none", None
    if res < 0:
        return "none", None
    return "time", round_jd_ut(float(tret[0]))


def main() -> int:
    random.seed(42)
    captured = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tool_version = str(swe.version)

    settings = {
        "limb": "disc_centre",
        "refraction": False,
        "positionMode": "geometric",
        "pressureHPa": 1013.25,
        "temperatureC": 15,
        "horizonAltitudeDeg": 0,
    }
    preset_id = "jhora-default@8.0"
    shash = settings_hash(settings)
    ephe_flags = se_ephe_flags(settings)
    rsmi_bits = se_rsmi_base(settings)

    cases: list[dict] = []
    n = 200
    for i in range(n):
        lat = random.uniform(-65, 65)
        lon = random.uniform(-180, 180)
        alt_m = random.choice([0, 0, 0, 250, 1200])
        year = random.randint(1980, 2024)
        month = random.randint(1, 12)
        day = random.randint(1, 28)
        jd_start = swe.julday(year, month, day, 0.0)
        geopos = [lon, lat, alt_m]

        body_name = random.choice(list(BODIES.keys()))
        body_id = BODIES[body_name]

        expected: dict = {}
        for ev_name, rsmi in EVENTS.items():
            kind, jd_ev = compute_event(
                jd_start,
                body_id,
                rsmi,
                geopos,
                ephe_flags,
                rsmi_bits,
                settings["pressureHPa"],
                settings["temperatureC"],
            )
            expected[f"riseset.{body_name}.{ev_name}.kind"] = {
                "value": kind,
                "tolerance": {"type": "exact"},
            }
            if kind == "time" and jd_ev is not None:
                expected[f"riseset.{body_name}.{ev_name}.jdUt"] = {
                    "value": jd_ev,
                    "tolerance": {"type": "seconds", "seconds": 1},
                }

        case_id = f"riseset-{i:03d}-{body_name.lower()}-{year}{month:02d}{day:02d}"
        cases.append(
            {
                "id": case_id,
                "provenance": {
                    "source": "pyswisseph",
                    "toolVersion": tool_version,
                    "capturedAt": captured,
                },
                "input": {
                    "instant": f"{year}-{month:02d}-{day:02d}T00:00:00Z",
                    "timezone": "UTC",
                    "lat": lat,
                    "lon": lon,
                    "alt": alt_m,
                    "settingsPresetId": preset_id,
                    "settingsHash": shash,
                },
                "settings": settings,
                "expected": expected,
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(cases, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(cases)} cases to {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
