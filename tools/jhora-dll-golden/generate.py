#!/usr/bin/env python3
"""Measure JHora 8.0's own Swiss Ephemeris DLL and write the accuracy goldens.

Writes packages/core/tests/fixtures/jhora_dll_golden.json. That file is a test
fixture only; no engine code imports it.

What is measured
  JHora 8.0 ships swedll32.dll (Swiss Ephemeris 2.02.01) and DE431-based .se1
  files. jhgold.c loads that DLL and calls it the way JHora's defaults do:
    ET = UT + swe_deltat(UT)
    swe_set_sid_mode(SE_SIDM_LAHIRI, 0, 0)
    swe_calc(ET, body, SEFLG_SWIEPH | SEFLG_TRUEPOS | SEFLG_SPEED | SEFLG_SIDEREAL)
    Spica forced to 180° sidereal: corr = λ(Spica, same flags) − 180°
    planet = λ − corr ; ayanamsa = swe_get_ayanamsa(ET) + corr
    houses = swe_houses(UT, lat, lon, hsys) tropical angles − ayanamsa
  That is "tropical − geometric True-Chitra ayanamsa". It reproduces JHora's
  printed reference chart (Greenwich J2000, 2000-01-01 12:00 UT) to the printed
  0.01″: ayanamsa 23-50-28.91, ascendant from jhora12 transcription.

Cases
  340 cases from random seed 20261026 (same generator as the validation
  harness): 240 uniform 1850–2150, range edges, high and polar latitudes,
  and 30 cases in 1800–1850 / 2150–2200 just outside DE440s.

Requires wine, a 32-bit Windows C compiler (`python3 -m ziglang cc`), and a
JHora 8.0 install. Neither the DLL nor the .se1 files are committed.

  python3 tools/jhora-dll-golden/generate.py \\
      --dll /path/to/jhcore/swedll32.dll --ephe /path/to/jhcore/ephe
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import random
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "packages" / "core" / "tests" / "fixtures" / "jhora_dll_golden.json"
SEED = 20261026

BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "MeanNode", "TrueNode"]
HSYS = ["W", "E", "P", "O"]


def make_cases() -> list[dict]:
    random.seed(SEED)

    def rnd(y0, y1, lat0=-60, lat1=65):
        a, b = dt.datetime(y0, 1, 1), dt.datetime(y1, 1, 1)
        t = a + dt.timedelta(seconds=random.randrange(int((b - a).total_seconds())))
        return dict(utc=t.strftime("%Y-%m-%dT%H:%M:%S"),
                    lat=round(random.uniform(lat0, lat1), 4),
                    lon=round(random.uniform(-180, 180), 4))

    plan = [("rand", 240, 1850, 2150, -60, 65), ("edge-lo", 15, 1850, 1852, -60, 65),
            ("edge-hi", 15, 2148, 2150, -60, 65), ("highlat", 20, 1850, 2150, 55, 65),
            ("highlat-s", 10, 1850, 2150, -60, -50), ("polar", 10, 1850, 2150, 66.6, 75),
            ("out-lo", 15, 1800, 1850, -60, 65), ("out-hi", 15, 2150, 2200, -60, 65)]
    cases = []
    for tag, n, y0, y1, la0, la1 in plan:
        for _ in range(n):
            cases.append(dict(tag=tag, **rnd(y0, y1, la0, la1)))
    for i, c in enumerate(cases):
        c["id"] = i
    return cases


def jd_ut(utc: str) -> float:
    d = dt.datetime.fromisoformat(utc)
    a = (14 - d.month) // 12
    y, m = d.year + 4800 - a, d.month + 12 * a - 3
    jdn = d.day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
    return jdn - 0.5 + (d.hour * 3600 + d.minute * 60 + d.second) / 86400


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dll", required=True)
    ap.add_argument("--ephe", required=True, help="JHora ephe directory")
    args = ap.parse_args()

    cases = make_cases()
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        shutil.copy(args.dll, t / "swedll32.dll")
        subprocess.run(["python3", "-m", "ziglang", "cc", "-target", "x86-windows-gnu", "-O2",
                        str(Path(__file__).with_name("jhgold.c")), "-o", str(t / "jhgold.exe")],
                       check=True)
        stdin = "".join(f"{jd_ut(c['utc']):.12f} {c['lat']:.6f} {c['lon']:.6f}\n" for c in cases)
        ephe = "Z:" + str(Path(args.ephe).resolve()).replace("/", "\\") + "\\"
        run = subprocess.run(["wine", "jhgold.exe", ephe], cwd=t, input=stdin, text=True,
                             capture_output=True, check=True, env={"WINEDEBUG": "-all", **__import__("os").environ})
        version = next(l.split()[1] for l in run.stderr.splitlines() if l.startswith("version"))
        lines = [l.strip() for l in run.stdout.splitlines() if l.strip()]

    assert len(lines) == len(cases), (len(lines), len(cases))
    out = []
    for c, line in zip(cases, lines):
        f = line.split()
        rec = dict(id=c["id"], tag=c["tag"], utc=c["utc"], lat=c["lat"], lon=c["lon"],
                   jdUT=float(f[0]), deltaTSeconds=float(f[1]), ayanamsa=float(f[2]),
                   bodies={b: float(f[3 + i]) for i, b in enumerate(BODIES)}, houses={})
        k = 12
        for h in HSYS:
            ret = int(f[k])
            rec["houses"][h] = dict(ret=ret, asc=float(f[k + 1]), mc=float(f[k + 2]),
                                    cusps=[float(x) for x in f[k + 3:k + 15]])
            k += 15
        out.append(rec)

    doc = {
        "provenance": {
            "oracle": f"JHora 8.0 bundled swedll32.dll, swe_version() = {version}",
            "ephemeris": "JHora 8.0 jhcore/ephe .se1 files (Swiss Ephemeris compression of JPL DE431)",
            "convention": "JHora defaults: geocentric, SEFLG_TRUEPOS, ET = UT + swe_deltat, "
                          "planets and angles = tropical − geometric True-Chitra (Spica 180°) ayanamsa",
            "bodies": "sidereal ecliptic longitude, degrees; MeanNode = SE_MEAN_NODE, TrueNode = SE_TRUE_NODE",
            "houses": "swe_houses(UT, lat, lon, hsys) minus ayanamsa; ret −1 means swe_houses fell back "
                      "to Porphyry (Placidus beyond the polar circle)",
            "deltaTSeconds": "swe_deltat(UT) × 86400",
            "cases": f"random seed {SEED}, tools/jhora-dll-golden/generate.py make_cases()",
            "generator": "tools/jhora-dll-golden/generate.py + jhgold.c (wine)",
            "capturedAt": dt.date.today().isoformat(),
            "use": "test fixture only; engine code never imports this file",
        },
        "cases": out,
    }
    OUT.write_text(json.dumps(doc, indent=1) + "\n")
    print(f"wrote {OUT} ({len(out)} cases, {version})")


if __name__ == "__main__":
    main()
