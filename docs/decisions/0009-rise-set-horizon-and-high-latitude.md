# Rise/set horizon: observed latitude rule

- Status: accepted
- Date: 2026-10-26
- Deciders: maintainers

Technical story: E3-S1-T1, PR 273

## Context and Problem Statement

Rise, set, and meridian transit have two oracles. The jhora profile is pinned
to a JHora 8.0 DLL capture (`riseset.jhora-dll.json`, tool 2.02.01). The
modern profile is pinned to pyswisseph 2.10.03 with a compressed planetary
ephemeris (`riseset.pyswisseph-se1.json`). Both captures ask for a geometric
disc centre and no refraction. Below about 60° the two clocks disagree by up
to a few seconds. Above that, a wider probe showed the modern clock changing
disc, and a two-hour bracket in this engine locking onto a neighbouring root.

The question is which disc each oracle puts on the horizon, at every
geographic latitude through ±90°, and how this engine should find the root.
The oracles are black boxes. This record is the behaviour of their outputs,
not a description of their source.

## Decision Drivers

- Each profile must match its own oracle to 1 second, or both must report no event.
- The rule has to be stable from 1900 through 2100 for the Sun, Moon, and planets.
- The implementation is written from Meeus and the Explanatory Supplement.
- No fitted time offset.

## Considered Options

- One disc for every latitude: geometric, or apparent.
- A single latitude cut for every body.
- The cuts measured below, one for the Sun and one for the other bodies.
- A two-hour sign search, which is what produced errors of about two hours on short polar arcs.

## Decision Outcome

Chosen option: "the cuts measured below", because that is what the oracle
times do, and a hour-angle estimate (Meeus, Astronomical Algorithms, ch. 15)
followed by a local root, because a two-hour sample cannot see a short arc.

### Observed behaviour

Places were classified by evaluating the topocentric true-of-date altitude at
the oracle's own event time. "Apparent" means the apparent place is on the
horizon and the geometric place is not. "Geometric" is the opposite. The grid
was latitudes 50° to 90° in both hemispheres, the Sun, Moon, and five planets,
and dates from 1900 through 2100. Disc centre, refraction off, geometric place
requested, height 0.

- **jhora.** The DLL capture is the geometric disc at every latitude in that
  file (up to 64.5°). On those 200 cases, pyswisseph 2.10.03's slow-method
  option reproduces the DLL to ≤ 0.48 s (mean 0.009 s). That same option stays
  on the geometric disc through ±90°, and it agrees with the default call on
  whether an event exists. The high-latitude jhora fixture is that slow-method
  capture. It is not a new DLL run; the DLL binary is not in this repository.
- **modern, Sun.** Apparent disc for |φ| ≤ 65°. Geometric disc for |φ| > 65°.
  The change is between 65.00° and 65.01°, in both hemispheres, and it does
  not depend on longitude. At 65.00° the apparent altitude at the event is
  0″ and the geometric altitude is about 15″; just above 65° those swap.
- **modern, other bodies.** Apparent disc for |φ| ≤ 60°. Geometric disc for
  |φ| > 60°. Same sharpness (60.00° apparent, 60.01° geometric), both
  hemispheres. Mercury's geometric and apparent altitudes differ by about
  25″, which near a grazing arc moves the clock by hours if the wrong disc
  is used.
- **modern, Moon.** The two places agree to < 1″, so the 60° cut does not
  move the Moon by a second. The same cut is still applied.
- **Transits, both oracles.** Upper and lower culmination are apparent right
  ascension equal to local apparent sidereal time, at every latitude,
  including when rise and set used the geometric disc.
- **No event.** When the body does not cross, both oracle calls return no
  event. The engine returns `{ kind: 'none' }` for those instants.
- **Look-ahead.** A one-off crossing is returned only when it falls inside
  26.0000 hours of the start. That was measured on events with no earlier
  crossing in the day (a polar Sun, a grazing Moon set), so the gap is the
  search window and not the spacing between two daily events. Daily Moon
  transits in the DLL capture reach 24.6 hours and are still returned. A Moon
  set 27.5 hours after the start is omitted even though the altitude does
  cross zero later. The engine searches that same 26-hour window, including
  when the hour-angle estimate has no solution at the start instant
  (declination can still bring a crossing in before the window ends).
- **ΔT.** Each profile uses its own ΔT model. The modern model is
  [ADR 0007](0007-modern-deltat-se210-black-box.md), which matches pyswisseph
  2.10 as shipped, including dates after 2026. No rise/set row stores an
  injected ΔT. The jhora clock is the 2.02 model. Where that clock and the
  2.10 clock have diverged (the high-latitude rows after 2026), the jhora
  times are the same slow-method geometry evaluated on the jhora ΔT. Before
  2026 the two clocks agree, and those rows stay the as-shipped capture.
- **Equator (frame bias).** The oracle's rise/set place is not the raw ICRF
  equator. At 2000-03-20 07:35:38.8 UT, the March-equinox Sun at the
  geographic pole, the geocentric ICRS ecliptic latitude is 0.2648″. This
  engine and the oracle's ICRS place agree there; Horizons DE441 prints
  0.2642″. The oracle's _default_ ecliptic latitude at that same instant is
  0.2437″. Taking the oracle's own ICRS ecliptic vector and applying the
  published IAU 2000 frame bias. IERS Technical Note 36, chapter 5
  (`tn36_043.pdf`) numbers the angles and not the matrix: dα₀ is
  eq. (5.21) and ξ₀, η₀ are eq. (5.33). Eq. (5.16) is the CIP X, Y
  series and eq. (5.32) is the GMST polynomial, so neither is B. The
  rotation is the separate frame-bias matrix of §5.4.5 and §5.9 (the
  equinox-based product N×P×B, SOFA BI00):

    B = R₁(−η₀) R₂(ξ₀) R₃(dα₀),

    with η₀ = −6.8192 mas, ξ₀ = −16.6170 mas and dα₀ = −14.6 mas, reproduces
    that default latitude to 0.00 mas. The same conversion holds for the Sun
    in 1900, 2000, 2024 and 2100, for Mercury and Venus in 2100, and for the
    Moon in 2000. The other sign and axis orders do not. Nothing is fitted.

    The bias is the general equator, not a switch that turns on near |φ| = 89°.
    0.021″ is about 0.001 s where the diurnal rate is 15″/s. It exceeds a
    second only when the altitude rate collapses to the declination rate, which
    is the geographic pole at an equinox (0.0165″/s). At |φ| = 90° the altitude
    is the declination, so that 0.021″ was 1.15–1.17 s of rise or set before
    the bias was applied, on both profiles, and only on those two events.

    Chart longitudes stay on the ICRF. The horizon path applies B to both the
    geometric and the apparent place, so the 60°/65° comparison of the two
    discs is unchanged. What remains is the difference between IAU 1980
    nutation and the oracle's default nutation, about 0.002″, under 0.2 s at
    the pole. Every event, including those four, is held to 1 s.

Dip of the sea horizon, used only when refraction is on, is the Nautical
Almanac value 1.76′ √h(m). With refraction off, elevated sites in the DLL
capture sit on the unrefracted geometric horizon, so dip is not applied.

### Consequences

- Good, because the 1-second bar is the same rule at the pole as at 55°.
- Good, because the cuts are constants measured from outputs, with a unit test on the constants.
- Bad, because the jhora grid above 64.5° is the slow-method reproduction of the DLL, not a fresh DLL capture. The 200-case DLL file remains the direct capture.
- Bad, because a future oracle release can move the cuts. Re-measure before changing the constants.

## Pros and Cons of the Options

### One disc at every latitude

- Good, because the jhora oracle really is one disc.
- Bad, because the modern oracle is not, and the Sun's cut is not the planets' cut.

### A single latitude cut for every body

- Good, because it is one constant.
- Bad, because the Sun is still apparent at 65.00° while Mercury has already changed at 60.01°.

### Measured Sun and planet cuts, plus a local hour-angle root

- Good, because it matches the classified event times, including short arcs.
- Bad, because the jhora numbers above the DLL's sampled latitudes are a reproduction, as noted above.

### Two-hour sign search

- Good, because it is simple where the diurnal arc is long.
- Bad, because a graze shorter than the sample, or a root near a sample boundary, returns a time about two hours away (the 7196 s Mercury failures).

## More Information

- [packages/core/docs/riseset.md](../../packages/core/docs/riseset.md)
- [ADR 0002](0002-clean-room-policy.md) — oracles are numbers, not source
- Meeus, _Astronomical Algorithms_, ch. 12 and ch. 15
- The Nautical Almanac, dip of the sea horizon; Explanatory Supplement, geometric dip √(2h/R)
- Bennett, _Journal of Navigation_ 35, 255–259 (1982); Saemundsson, _Sky & Telescope_ 72, 70 (1986)
