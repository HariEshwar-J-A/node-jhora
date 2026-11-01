"""
Lahiri ayanamsa (degrees) for the shared bench table (see ADR 0024).
"""

from __future__ import annotations

import math

LAHIRI_ANCHOR_JD = 2435553.5
LAHIRI_ANCHOR_AYANAMSA_DEG = 23.25


def _precession_longitude_rad(t0: float, t: float) -> float:
    dt = t - t0
    arcsec = (
        5029.0966
        + 1.1129948 * (t + t0)
        + 0.000006770 * (t + t0) ** 2
        - 0.0000000236 * (t + t0) ** 3
    ) * dt
    return math.radians(arcsec / 3600.0)


def lahiri_ayanamsa_deg(jd_ut: float, delta_t_seconds: float) -> float:
    jd_tt = jd_ut + delta_t_seconds / 86400.0
    t = (jd_tt - 2451545.0) / 36525.0
    t0 = (LAHIRI_ANCHOR_JD - 2451545.0) / 36525.0
    return LAHIRI_ANCHOR_AYANAMSA_DEG + math.degrees(_precession_longitude_rad(t0, t))
