"""
Independent DE441 secular mean node (truth deep-era plan step 4).

Uses jplephem + DE441 part-1/part-2 BSP (NAIF public domain). Geocentric Moon
r,v in the SSB frame, rotated with pyerfa onto the truth mean ecliptic.
"""

from __future__ import annotations

import math
import os
from pathlib import Path

import erfa
import numpy as np

DRACONIC_P = 6798.383
HALF_WINDOW_JD = 250 * 365.25
SAMPLE_STEP = 4.0
J2000 = 2451545.0
# JPL DE441 native TDB span (part-1 + part-2)
DE441_JDTDB_MIN = -3_100_015.5
DE441_JDTDB_MAX = 8_000_016.5

_eph = None


class _SpkPair:
    """Try DE441 part-1 then part-2 (NAIF split kernels)."""

    def __init__(self, paths: list[Path]):
        from jplephem.spk import SPK

        self._spks = [SPK.open(str(p)) for p in paths if p.exists()]

    def moon_earth_geocentric(self, jdtdb: float) -> tuple[np.ndarray, np.ndarray] | None:
        msegs = [
            seg for spk in self._spks for seg in spk.segments if seg.target == 301 and seg.center == 3
        ]
        esegs = [
            seg for spk in self._spks for seg in spk.segments if seg.target == 399 and seg.center == 3
        ]
        for mseg in msegs:
            for eseg in esegs:
                try:
                    mp, mv = mseg.compute_and_differentiate(jdtdb)
                    ep, ev = eseg.compute_and_differentiate(jdtdb)
                    r = np.asarray(mp, dtype=float) - np.asarray(ep, dtype=float)
                    v = np.asarray(mv, dtype=float) - np.asarray(ev, dtype=float)
                    return r, v
                except Exception:
                    continue
        return None


def _load_eph():
    global _eph
    if _eph is not None:
        return _eph
    try:
        from jplephem.spk import SPK  # noqa: F401
    except ImportError:
        return None
    root = Path(__file__).resolve().parents[2]
    cache = root / "packages/ephe441/.cache"
    p1 = Path(os.environ.get("DE441_PART1_PATH", cache / "de441_part-1.bsp"))
    p2 = Path(os.environ.get("DE441_PART2_PATH", cache / "de441_part-2.bsp"))
    if not p1.exists() and not p2.exists():
        return None
    _eph = _SpkPair([p1, p2])
    return _eph


def _jdtt_to_t(jdtt: float) -> float:
    return (jdtt - J2000) / 36525.0


def _icrf_to_truth_ecliptic(v: np.ndarray, jdtt: float) -> np.ndarray:
    if 2305448.0 <= jdtt <= 2524594.0:
        r = np.asarray(erfa.pnm06a(J2000, jdtt - J2000)[0], dtype=float)
        return r @ v
    epj = 2000.0 + (jdtt - J2000) / 365.25
    r = np.asarray(erfa.ltecm(epj), dtype=float)
    return r @ v


def _jdtt_to_tdb(jdtt: float) -> float:
    dtdb_s = erfa.dtdb(J2000, jdtt - J2000, 0.0, 0.0, 0.0, 0.0)
    return jdtt + dtdb_s / 86400.0


def _moon_geocentric_km(jdtt: float) -> tuple[np.ndarray, np.ndarray] | None:
    eph = _load_eph()
    if eph is None:
        return None
    jdtdb = _jdtt_to_tdb(jdtt)
    return eph.moon_earth_geocentric(jdtdb)


def _jdtt_in_de441(jdtt: float) -> bool:
    jdtdb = _jdtt_to_tdb(jdtt)
    return DE441_JDTDB_MIN <= jdtdb <= DE441_JDTDB_MAX


def secular_window_clipped(jdtt: float) -> bool:
    """True when the nominal ±250 yr window extends outside DE441 coverage."""
    half_p = DRACONIC_P / 2.0
    win_lo = jdtt - HALF_WINDOW_JD - half_p
    win_hi = jdtt + HALF_WINDOW_JD + half_p
    return win_lo < DE441_JDTDB_MIN or win_hi > DE441_JDTDB_MAX


def _osculating_node_deg(jdtt: float) -> float | None:
    if not _jdtt_in_de441(jdtt):
        return None
    st = _moon_geocentric_km(jdtt)
    if st is None:
        return None
    r, v = st
    re = _icrf_to_truth_ecliptic(r, jdtt)
    ve = _icrf_to_truth_ecliptic(v, jdtt)
    h = np.cross(re, ve)
    return math.degrees(math.atan2(h[0], -h[1])) % 360.0


def _unwrap(y: float, ref: float) -> float:
    d = y - ref
    if d > 180:
        d -= 360
    if d < -180:
        d += 360
    return ref + d


def cycle_intercept(jd_centre: float) -> float | None:
    half = DRACONIC_P / 2.0
    ts: list[float] = []
    ys: list[float] = []
    prev: float | None = None
    jd = jd_centre - half
    while jd <= jd_centre + half + 1e-9:
        om = _osculating_node_deg(jd)
        if om is not None:
            y = om if prev is None else _unwrap(om, prev)
            prev = y
            ts.append(jd - jd_centre)
            ys.append(y)
        jd += SAMPLE_STEP
    if len(ts) < 3:
        return None
    n = len(ts)
    sum_t = sum(ts)
    sum_y = sum(ys)
    sum_tt = sum(t * t for t in ts)
    sum_ty = sum(t * y for t, y in zip(ts, ys))
    denom = n * sum_tt - sum_t * sum_t
    slope = (n * sum_ty - sum_t * sum_y) / denom if abs(denom) > 1e-12 else 0.0
    intercept = (sum_y - slope * sum_t) / n
    return intercept


def secular_mean_node_deg(jdtt: float) -> float | None:
    k_max = int(HALF_WINDOW_JD / DRACONIC_P)
    intercepts: list[float] = []
    prev: float | None = None
    for k in range(-k_max, k_max + 1):
        centre = jdtt + k * DRACONIC_P
        ic = cycle_intercept(centre)
        if ic is None:
            continue
        y = ic if prev is None else _unwrap(ic, prev)
        prev = y
        intercepts.append(y)
    if not intercepts:
        return None
    mean = sum(intercepts) / len(intercepts)
    return mean % 360.0


def faom03_deg(jdtt: float) -> float:
    t = _jdtt_to_t(jdtt)
    om_as = (
        (
            (
                450160.398036
                + t * (-6962890.5431 + t * (7.4722 + t * (0.007702 + t * -0.00005939)))
            )
            % 1296000
        )
        + 1296000
    ) % 1296000
    return om_as / 3600.0 % 360.0
