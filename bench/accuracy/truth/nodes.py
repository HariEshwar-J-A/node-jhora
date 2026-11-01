"""
Lunar nodes for the accuracy bench.

Mean: Meeus *Astronomical Algorithms* eq. 47.7 (Chapront-Touzé & Chapront 1991).
True: DE440/441 geocentric Moon ascending node via production clean-room osculating
chain (mean ecliptic of date, apparent nutation policy — see ADR 0024 / lunar-node.ts).
"""

from __future__ import annotations

import math

J2000_JD = 2451545.0
C_KM_S = 299792.458
AU_KM = 149597870.7
GM_EARTH = 398600.435436
GM_MOON = 4902.800066
GM_EM = GM_EARTH + GM_MOON


def mean_node_longitude_deg(jd_tt: float) -> float:
    t = (jd_tt - J2000_JD) / 36525.0
    omega = (
        125.044_547_9
        - 1_934.136_289_1 * t
        + 0.002_075_4 * t * t
        + t * t * t / 467_441
        - t * t * t * t / 60_616_000
    )
    return omega % 360.0


def _cross(a: list[float], b: list[float]) -> list[float]:
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def _dot(a: list[float], b: list[float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _norm(a: list[float]) -> float:
    return math.hypot(a[0], a[1], a[2])


def ascending_node_lon_from_ecliptic(pos: list[float], vel: list[float]) -> float:
    hx, hy, _ = _cross(pos, vel)
    return math.degrees(math.atan2(hx, -hy)) % 360.0


def true_node_longitude_deg(
    jd_ut: float,
    delta_t: float,
    moon_icrf_km: list[float],
    moon_icrf_km_s: list[float],
    frame_bridge,
    nutation_dpsi_deg: float,
    apply_light_time: bool,
) -> float:
    rel = moon_icrf_km
    vel = moon_icrf_km_s
    eval_jd = jd_ut
    if apply_light_time:
        tau_days = _norm(rel) / C_KM_S / 86400.0
        eval_jd = jd_ut - tau_days

    sec_per_day = 86400.0  # shared ΔT table frozen per epoch in bench
    vel_km_day = [v * sec_per_day for v in vel]
    pos_ecl = frame_bridge.icrf_biased_to_mean_ecliptic_km(eval_jd, delta_t, rel)
    vel_ecl = frame_bridge.icrf_biased_to_mean_ecliptic_km(eval_jd, delta_t, vel_km_day)
    lon = ascending_node_lon_from_ecliptic(pos_ecl, vel_ecl)
    if nutation_dpsi_deg:
        lon = (lon + nutation_dpsi_deg) % 360.0
    return lon
