#!/usr/bin/env python3
"""Measure Swiss Ephemeris 2.10 (pyswisseph) and write the 'modern' goldens.

Writes packages/core/tests/fixtures/modern_se210_golden.json, a test fixture
for the 'modern' precision profile. No engine code reads it.

Oracle: pyswisseph 2.10.03, run on real DE431-based .se1 files. Pass a
directory that holds sepl_18/semo_18 (and the files for the other centuries).
JHora 8.0 ships one in jhcore/ephe. The script refuses to run if Swiss
Ephemeris falls back to its built-in Moshier model.

Cases are the same 340 random cases (seed 20261026) as the JHora DLL goldens,
from tools/jhora-dll-golden/generate.py make_cases().

Calls, Swiss Ephemeris defaults otherwise:
  swe_set_sid_mode(SE_SIDM_TRUE_CITRA)
  bodies   : swe_calc_ut(jd, ipl, SWIEPH|TRUEPOS|SIDEREAL)[0]
  ayanamsa : swe_get_ayanamsa_ut(jd)   (apparent star place, no nutation)
  houses   : swe_houses_ex(jd, SIDEREAL, lat, lon, hsys)
             Placidus inside the polar circle: SE switches to Porphyry and
             reports an error, so 'P' records ret −1 with the Porphyry cusps.
  deltaT   : swe_deltat(jd) × 86400 (stored so the "future ΔT" tests can
             inject the oracle's own predicted ΔT; see the test header)

  python3 tools/modern-golden/generate.py --ephe /path/to/jhcore/ephe
"""
import argparse
import datetime as dt
import importlib.util
import json
from pathlib import Path

import swisseph as swe

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "packages" / "core" / "tests" / "fixtures" / "modern_se210_golden.json"

spec = importlib.util.spec_from_file_location("jhgen", ROOT / "tools" / "jhora-dll-golden" / "generate.py")
jhgen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(jhgen)

BODIES = {"Sun": 0, "Moon": 1, "Mercury": 2, "Venus": 3, "Mars": 4, "Jupiter": 5, "Saturn": 6,
          "MeanNode": 10, "TrueNode": 11}
HSYS = ["W", "E", "P", "O"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ephe", required=True, help="directory of DE431-based .se1 files")
    args = ap.parse_args()
    swe.set_ephe_path(str(Path(args.ephe).resolve()) + "/")
    swe.set_sid_mode(swe.SIDM_TRUE_CITRA)
    flags = swe.FLG_SWIEPH | swe.FLG_TRUEPOS | swe.FLG_SIDEREAL

    out = []
    for c in jhgen.make_cases():
        jd = jhgen.jd_ut(c["utc"])
        rec = dict(id=c["id"], tag=c["tag"], utc=c["utc"], lat=c["lat"], lon=c["lon"], jdUT=jd,
                   deltaTSeconds=round(swe.deltat(jd) * 86400, 6),
                   ayanamsa=round(swe.get_ayanamsa_ut(jd), 12), bodies={}, houses={})
        for name, ipl in BODIES.items():
            xx, ret = swe.calc_ut(jd, ipl, flags)
            if ret & swe.FLG_MOSEPH or not ret & swe.FLG_SWIEPH:
                raise SystemExit(f"case {c['id']} {name}: not computed from .se1 files (flags {ret})")
            rec["bodies"][name] = round(xx[0], 12)
        for h in HSYS:
            ret = 0
            try:
                cusps, ascmc = swe.houses_ex(jd, c["lat"], c["lon"], h.encode(), swe.FLG_SIDEREAL)
            except swe.Error:
                if h != "P":
                    raise
                ret = -1
                cusps, ascmc = swe.houses_ex(jd, c["lat"], c["lon"], b"O", swe.FLG_SIDEREAL)
            rec["houses"][h] = dict(ret=ret, asc=round(ascmc[0], 12), mc=round(ascmc[1], 12),
                                    cusps=[round(x, 12) for x in cusps[:12]])
        out.append(rec)

    doc = {
        "provenance": {
            "oracle": f"pyswisseph {swe.__version__ if hasattr(swe, '__version__') else ''} / Swiss Ephemeris {swe.version}",
            "ephemeris": "Swiss Ephemeris .se1 files compressed from JPL DE431 (JHora 8.0 jhcore/ephe); "
                         f"tidal acceleration {swe.get_tid_acc()}″/cy²",
            "convention": "SE_SIDM_TRUE_CITRA; bodies swe_calc_ut(SWIEPH|TRUEPOS|SIDEREAL); "
                          "ayanamsa swe_get_ayanamsa_ut; houses swe_houses_ex(SEFLG_SIDEREAL)",
            "houses": "ret −1: Placidus inside the polar circle, SE switched to Porphyry",
            "deltaTSeconds": "swe_deltat(UT) × 86400; SE's own value, used as test data only "
                             "(injected via deltaTOverrideSeconds for dates past the observed record)",
            "cases": "random seed 20261026, tools/jhora-dll-golden/generate.py make_cases()",
            "generator": "tools/modern-golden/generate.py",
            "capturedAt": dt.date.today().isoformat(),
            "use": "test fixture only; engine code never imports this file",
        },
        "cases": out,
    }
    OUT.write_text(json.dumps(doc, indent=1) + "\n")
    print(f"wrote {OUT} ({len(out)} cases, SE {swe.version})")


if __name__ == "__main__":
    main()
