"""
Published truth-profile chart frame (ADR 0027 / truth_profile_erfa.json).

Geocentric apparent place on DE440/DE441 via Skyfield, SPK time in TDB (ERFA dtdb),
two-part Julian dates for light-time, ICRS → mean ecliptic (ERFA ecm06 once) with
longitude on the true equinox of date (+ nut06a Δψ only on λ). Latitude is mean
ecliptic. Matches packages/core truth precision profile golden fixture.
"""

from __future__ import annotations

import math

import erfa
import numpy as np

C_KM_S = 299792.458
J2000_JD = 2451545.0


def split_jd_tdb(jd_tdb: float) -> tuple[float, float]:
    d = math.floor(jd_tdb)
    return d, jd_tdb - d


def subtract_tau_from_tdb_parts(d: float, f: float, tau_days: float) -> tuple[float, float]:
    f_prime = f - tau_days
    d_prime = d
    while f_prime < 0:
        f_prime += 1.0
        d_prime -= 1.0
    while f_prime >= 1.0:
        f_prime -= 1.0
        d_prime += 1.0
    return d_prime, f_prime


def jd_tt_parts(jd_tt: float) -> tuple[float, float]:
    return J2000_JD, jd_tt - J2000_JD


def jd_tdb_from_tt(jd_tt: float) -> float:
    d1, d2 = jd_tt_parts(jd_tt)
    return jd_tt + float(erfa.dtdb(d1, d2, 0.0, 0.0, 0.0, 0.0)) / 86400.0


def nutation_dpsi_deg(jd_tt: float) -> float:
    d1, d2 = jd_tt_parts(jd_tt)
    dpsi, _deps = erfa.nut06a(d1, d2)
    return math.degrees(dpsi)


def ecliptic_lon_lat(u: np.ndarray) -> tuple[float, float]:
    lon = math.degrees(math.atan2(u[1], u[0])) % 360.0
    lat = math.degrees(math.atan2(u[2], math.hypot(u[1], u[0])))
    return lon, lat


def chart_ecliptic_from_icrf_km(km: np.ndarray, jd_tt: float) -> tuple[float, float]:
    u = km / np.linalg.norm(km)
    d1, d2 = jd_tt_parts(jd_tt)
    m = erfa.ecm06(d1, d2)
    lon_m, lat = ecliptic_lon_lat(m @ u)
    lon = (lon_m + nutation_dpsi_deg(jd_tt)) % 360.0
    return lon, lat


def ascending_node_lon(pos: np.ndarray, vel: np.ndarray) -> float:
    hx = pos[1] * vel[2] - pos[2] * vel[1]
    hy = pos[2] * vel[0] - pos[0] * vel[2]
    return math.degrees(math.atan2(hx, -hy)) % 360.0


def truth_true_node_deg(earth, moon, ts, jd_ut: float, dt: float) -> float:
    jd_tt_r = jd_ut + dt / 86400.0
    jd_tdb_r = jd_tdb_from_tt(jd_tt_r)
    d_r, f_r = split_jd_tdb(jd_tdb_r)
    t_r = ts.tdb_jd(d_r, f_r)
    r0 = np.asarray((moon.at(t_r) - earth.at(t_r)).position.km, dtype=float)
    tau = float(np.linalg.norm(r0)) / C_KM_S / 86400.0
    d_m, f_m = subtract_tau_from_tdb_parts(d_r, f_r, tau)
    t_m = ts.tdb_jd(d_m, f_m)
    r = np.asarray((moon.at(t_m) - earth.at(t_r)).position.km, dtype=float)
    v = np.asarray((moon.at(t_m) - earth.at(t_r)).velocity.km_per_s, dtype=float) * 86400.0
    d1, d2 = jd_tt_parts(jd_tt_r)
    m = erfa.ecm06(d1, d2)
    re = m @ r
    ve = m @ v
    lon = ascending_node_lon(re, ve)
    return (lon + nutation_dpsi_deg(jd_tt_r)) % 360.0


def mean_node_longitude_deg(jd_tt: float) -> float:
    return math.degrees(erfa.faom03((jd_tt - J2000_JD) / 36525.0)) % 360.0


def apparent_body_icrf_km(earth, body, ts, jd_ut: float, dt: float) -> np.ndarray:
    jd_tt = jd_ut + dt / 86400.0
    jd_tdb = jd_tdb_from_tt(jd_tt)
    d_tdb, f_tdb = split_jd_tdb(jd_tdb)
    t = ts.tdb_jd(d_tdb, f_tdb)
    return np.asarray(earth.at(t).observe(body).apparent().position.km, dtype=float)


def tropical_truth_profile_lon_lat(
    earth, body, ts, jd_ut: float, dt: float
) -> tuple[float, float]:
    km = apparent_body_icrf_km(earth, body, ts, jd_ut, dt)
    jd_tt = jd_ut + dt / 86400.0
    return chart_ecliptic_from_icrf_km(km, jd_tt)
