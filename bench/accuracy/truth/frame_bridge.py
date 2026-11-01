"""Call bench Node CLIs for chart frame / Lahiri (Vondrák 2011 + IAE definition in core)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

BENCH_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BENCH_ROOT.parents[1]


def _run_cli(script: str, payload: dict) -> dict:
    proc = subprocess.run(
        ['node', str(BENCH_ROOT / 'truth' / script)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f'{script} failed: {proc.stderr}')
    return json.loads(proc.stdout)


def chart_ecliptic_unit(jd_ut: float, delta_t: float, icrf_unit: list[float]) -> tuple[float, float]:
    doc = _run_cli(
        'chart_frame_cli.mjs',
        {'jdUt': jd_ut, 'deltaTOverrideSeconds': delta_t, 'vectors': [{'icrf': icrf_unit}]},
    )
    r = doc['results'][0]
    return r['lon'], r['lat']


def icrf_biased_to_mean_ecliptic_km(jd_ut: float, delta_t: float, icrf_km: list[float]) -> list[float]:
    doc = _run_cli(
        'chart_frame_cli.mjs',
        {
            'jdUt': jd_ut,
            'deltaTOverrideSeconds': delta_t,
            'vectors': [{'icrf': icrf_km, 'mode': 'biased_ecliptic_km'}],
        },
    )
    return doc['results'][0]['xyz']


def lahiri_iae_ayanamsa_deg(jd_ut: float) -> float:
    doc = _run_cli('lahiri_cli.mjs', {'jdUt': jd_ut})
    return float(doc['lahiriIaeAyanamsaDeg'])
