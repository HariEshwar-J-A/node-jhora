"""
Independent true (osculating) lunar node truth — Skyfield DE440/DE441 + ERFA only.

Convention TN-MED-LT1 (headline `tropicalTrue` for TrueNode):
  - Geocentric Moon (r, v) from DE kernel via Skyfield `.observe()` without
    `.apparent()` (no stellar aberration / deflection on the state).
  - One-shot light-time retardation: τ = |r( jd_ut )| / c, evaluate state at
    jd_eval = jd_ut − τ (shared ΔT at jd_eval for TT and ERFA arguments).
  - IAU 2006 bias-precession `rbp` from ERFA bp06 (ICRS → mean equator of date),
    then rotation to mean ecliptic with mean obliquity obl06 (same as ecm06).
  - Ascending node longitude from h = r × v in that mean ecliptic frame.
  - Add nutation in longitude Δψ from ERFA nut06a exactly once (true equinox
    of date for the published apparent-node comparison policy).

Convention TN-MED-INST (reporting only, `trueNodeInstant` in truth rows):
  - Same as TN-MED-LT1 but state sampled at jd_ut (no one-shot retardation).

node-jhora uses Vondrák 2011 mean ecliptic + engine nutation(); residuals vs this
ERFA truth are reported honestly (typically a few arcseconds on TrueNode).
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

import erfa
import numpy as np

if TYPE_CHECKING:
    from skyfield.timelib import Time

C_KM_S = 299792.458


def _jd_tt_split(jd_tt: float) -> tuple[float, float]:
    return 2400000.5, jd_tt - 2400000.5


def _mean_obliquity_rotation(eps: float) -> np.ndarray:
    c, s = math.cos(eps), math.sin(eps)
    return np.array([[1.0, 0.0, 0.0], [0.0, c, s], [0.0, -s, c]], dtype=float)


def _icrs_to_mean_ecliptic_matrix(d1: float, d2: float) -> np.ndarray:
    """ICRS → mean ecliptic of date (matches erfa.ecm06 to machine precision)."""
    _rb, _rp, rbp = erfa.bp06(d1, d2)
    eps = erfa.obl06(d1, d2)
    return _mean_obliquity_rotation(eps) @ rbp


def _mean_ecliptic_node_deg(
    icrf_km: np.ndarray, icrf_km_per_day: np.ndarray, jd_tt: float
) -> float:
    """Mean ecliptic ascending node from ICRS state via ERFA ecm06 on h = r × v."""
    d1, d2 = _jd_tt_split(jd_tt)
    h = np.cross(icrf_km, icrf_km_per_day)
    h_ecl = erfa.ecm06(d1, d2) @ h
    return ascending_node_from_h_ecl(h_ecl)


def _mean_ecliptic_node_deg_bp06_route(
    icrf_km: np.ndarray, icrf_km_per_day: np.ndarray, jd_tt: float
) -> float:
    """Second ERFA route: obl06 ∘ rbp (bp06) on h = r × v — must match ecm06."""
    d1, d2 = _jd_tt_split(jd_tt)
    h = np.cross(icrf_km, icrf_km_per_day)
    h_ecl = _icrs_to_mean_ecliptic_matrix(d1, d2) @ h
    return ascending_node_from_h_ecl(h_ecl)


def _to_mean_ecliptic_km(
    icrf_km: np.ndarray, icrf_km_per_day: np.ndarray, jd_tt: float
) -> tuple[np.ndarray, np.ndarray]:
    d1, d2 = _jd_tt_split(jd_tt)
    m = _icrs_to_mean_ecliptic_matrix(d1, d2)
    return m @ icrf_km, m @ icrf_km_per_day


def ascending_node_longitude_deg(pos: np.ndarray, vel: np.ndarray) -> float:
    hx = pos[1] * vel[2] - pos[2] * vel[1]
    hy = pos[2] * vel[0] - pos[0] * vel[2]
    return math.degrees(math.atan2(hx, -hy)) % 360.0


def ascending_node_from_h_ecl(h_ecl: np.ndarray) -> float:
    return math.degrees(math.atan2(float(h_ecl[0]), -float(h_ecl[1]))) % 360.0


def nutation_dpsi_deg(jd_tt: float) -> float:
    d1, d2 = _jd_tt_split(jd_tt)
    dpsi, _deps = erfa.nut06a(d1, d2)
    return math.degrees(dpsi)


def geocentric_moon_icrf_km(
    earth, moon, ts, jd_ut: float, delta_t_seconds: float
) -> tuple[np.ndarray, np.ndarray]:
    """
    Geocentric Moon from DE kernel without Skyfield's built-in light-time loop
    (one-shot retardation is applied separately in TN-MED-LT1).
    """
    return geocentric_moon_icrf_km_alt(earth, moon, ts, jd_ut, delta_t_seconds)


def geocentric_moon_icrf_km_alt(
    earth, moon, ts, jd_ut: float, delta_t_seconds: float
) -> tuple[np.ndarray, np.ndarray]:
    """Independent extraction: barycentric Moon − Earth at same TT."""
    jd_tt = jd_ut + delta_t_seconds / 86400.0
    t = ts.tt_jd(jd_tt)
    r = np.asarray((moon.at(t) - earth.at(t)).position.km, dtype=float)
    v = np.asarray((moon.at(t) - earth.at(t)).velocity.km_per_s, dtype=float)
    return r, v


def moon_state_agreement_arcsec(
    earth,
    moon,
    ts,
    jd_ut: float,
    delta_t_seconds: float,
) -> float:
    """Barycentric geocentric vs itself (sanity); expect ~0."""
    r1, _ = geocentric_moon_icrf_km(earth, moon, ts, jd_ut, delta_t_seconds)
    r2, _ = geocentric_moon_icrf_km_alt(earth, moon, ts, jd_ut, delta_t_seconds)
    u1 = r1 / np.linalg.norm(r1)
    u2 = r2 / np.linalg.norm(r2)
    dot = float(np.clip(np.dot(u1, u2), -1.0, 1.0))
    return math.degrees(math.acos(dot)) * 3600.0


def moon_observe_vs_barycentric_arcsec(
    earth,
    moon,
    ts,
    jd_ut: float,
    delta_t_seconds: float,
) -> float:
    """Skyfield `.observe()` includes light-time; barycentric difference does not."""
    jd_tt = jd_ut + delta_t_seconds / 86400.0
    t = ts.tt_jd(jd_tt)
    r_obs = np.asarray(earth.at(t).observe(moon).position.km, dtype=float)
    r_bar, _ = geocentric_moon_icrf_km_alt(earth, moon, ts, jd_ut, delta_t_seconds)
    u1 = r_obs / np.linalg.norm(r_obs)
    u2 = r_bar / np.linalg.norm(r_bar)
    dot = float(np.clip(np.dot(u1, u2), -1.0, 1.0))
    return math.degrees(math.acos(dot)) * 3600.0


def true_node_tn_med(
    earth,
    moon,
    ts,
    jd_ut: float,
    delta_t_seconds: float,
    *,
    light_time_retardation: bool,
) -> tuple[float, float, float]:
    """
    Returns (apparent_longitude_deg, mean_ecliptic_node_deg, dpsi_deg).
    Apparent = mean node + nut06a Δψ.
    """
    r0, v0 = geocentric_moon_icrf_km(earth, moon, ts, jd_ut, delta_t_seconds)
    eval_jd = jd_ut
    if light_time_retardation:
        tau_days = float(np.linalg.norm(r0)) / C_KM_S / 86400.0
        eval_jd = jd_ut - tau_days

    # Re-use ΔT at evaluation epoch (matches retarded sampling in engine policy).
    dt_eval = delta_t_seconds
    r, v = geocentric_moon_icrf_km(earth, moon, ts, eval_jd, dt_eval)
    jd_tt = eval_jd + dt_eval / 86400.0
    v_day = v * 86400.0
    lon_mean = _mean_ecliptic_node_deg(r, v_day, jd_tt)
    dpsi = nutation_dpsi_deg(jd_tt)
    lon_app = (lon_mean + dpsi) % 360.0
    return lon_app, lon_mean, dpsi


def true_node_skyfield_ecliptic_rotation(
    earth,
    moon,
    ts,
    jd_ut: float,
    delta_t_seconds: float,
    *,
    light_time_retardation: bool,
) -> float:
    """Second route: Skyfield ecliptic frame rotation on the same ICRS state."""
    from skyfield import framelib

    r0, _ = geocentric_moon_icrf_km(earth, moon, ts, jd_ut, delta_t_seconds)
    eval_jd = jd_ut
    if light_time_retardation:
        tau_days = float(np.linalg.norm(r0)) / C_KM_S / 86400.0
        eval_jd = jd_ut - tau_days
    r, v = geocentric_moon_icrf_km(earth, moon, ts, eval_jd, delta_t_seconds)
    jd_tt = eval_jd + delta_t_seconds / 86400.0
    t = ts.tt_jd(jd_tt)
    rot = framelib.ecliptic_frame.rotation_at(t)
    re = rot @ r
    ve = rot @ (v * 86400.0)
    return ascending_node_longitude_deg(re, ve)


def true_node_erfa_ecm06_inertial(
    earth,
    moon,
    ts,
    jd_ut: float,
    delta_t_seconds: float,
    *,
    light_time_retardation: bool,
) -> float:
    """Auxiliary route: ICRS → inertial ecliptic of date (ecm06), node without Δψ."""
    r0, _ = geocentric_moon_icrf_km(earth, moon, ts, jd_ut, delta_t_seconds)
    eval_jd = jd_ut
    if light_time_retardation:
        tau_days = float(np.linalg.norm(r0)) / C_KM_S / 86400.0
        eval_jd = jd_ut - tau_days
    r, v = geocentric_moon_icrf_km(earth, moon, ts, eval_jd, delta_t_seconds)
    jd_tt = eval_jd + delta_t_seconds / 86400.0
    d1, d2 = _jd_tt_split(jd_tt)
    rm = erfa.ecm06(d1, d2)
    re = rm @ r
    ve = rm @ (v * 86400.0)
    return ascending_node_longitude_deg(re, ve)


def cross_check_mean_ecliptic_routes(
    earth,
    moon,
    ts,
    jd_ut: float,
    delta_t_seconds: float,
) -> dict:
    """
    Gate: ERFA ecm06 vs obl06∘rbp (bp06) on the same DE ICRS h (before Δψ).
    Skyfield true ecliptic of date is logged vs mean and vs TN-MED apparent.
    """
    r0, _ = geocentric_moon_icrf_km(earth, moon, ts, jd_ut, delta_t_seconds)
    eval_jd = jd_ut - float(np.linalg.norm(r0)) / C_KM_S / 86400.0
    r, v = geocentric_moon_icrf_km(earth, moon, ts, eval_jd, delta_t_seconds)
    jd_tt = eval_jd + delta_t_seconds / 86400.0
    v_day = v * 86400.0
    d1, d2 = _jd_tt_split(jd_tt)
    h = np.cross(r, v_day)
    lon_ecm = ascending_node_from_h_ecl(erfa.ecm06(d1, d2) @ h)
    lon_bp06 = _mean_ecliptic_node_deg_bp06_route(r, v_day, jd_tt)
    d_erfa_arcsec = ((lon_bp06 - lon_ecm + 540.0) % 360.0 - 180.0) * 3600.0

    from skyfield import framelib

    t = ts.tt_jd(jd_tt)
    # Skyfield: true ecliptic and equinox of date (mean obliquity + nutation in obliquity).
    rot_true = framelib.ecliptic_frame.rotation_at(t)
    lon_sky_true = ascending_node_from_h_ecl(rot_true @ h)
    dpsi = nutation_dpsi_deg(jd_tt)
    lon_apparent = (lon_ecm + dpsi) % 360.0
    d_sky_vs_mean_arcsec = ((lon_sky_true - lon_ecm + 540.0) % 360.0 - 180.0) * 3600.0
    d_sky_vs_apparent_arcsec = ((lon_sky_true - lon_apparent + 540.0) % 360.0 - 180.0) * 3600.0
    return {
        "jdUt": jd_ut,
        "meanEclipticNodeEcm06Deg": lon_ecm,
        "meanEclipticNodeBp06Deg": lon_bp06,
        "dErfaEcm06VsBp06Arcsec": d_erfa_arcsec,
        "trueNodeApparentTnMedDeg": lon_apparent,
        "meanEclipticNodeSkyfieldTrueDeg": lon_sky_true,
        "dSkyfieldTrueEclipticVsMeanEcm06Arcsec": d_sky_vs_mean_arcsec,
        "dSkyfieldTrueEclipticVsApparentTnMedArcsec": d_sky_vs_apparent_arcsec,
        "skyfieldEclipticFrameNote": (
            "Skyfield framelib.ecliptic_frame is true ecliptic/equinox of date; "
            "TN-MED headline uses mean ecliptic (ecm06) + nut06a Δψ once."
        ),
        "moonStateAgreementArcsec": moon_state_agreement_arcsec(
            earth, moon, ts, eval_jd, delta_t_seconds
        ),
        "moonObserveVsBarycentricArcsec": moon_observe_vs_barycentric_arcsec(
            earth, moon, ts, eval_jd, delta_t_seconds
        ),
    }
