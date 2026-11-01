# Architecture decision log

Architecture decisions for node-jhora are recorded here in
[MADR](https://adr.github.io/madr/) form. The template is
[0000-template.md](0000-template.md). Copy it to the next free number when a
choice will be expensive to reverse, will change a golden tolerance, or picks
a convention JHora does not document.

Status is `proposed` while the choice is still open, `accepted` once it is
binding, and `superseded by ADR-NNNN` when a later record replaces it. Do not
delete an accepted ADR; supersede it.

[ADR 0001](0001-record-architecture-decisions.md) is the decision to keep this
log. The clean-room rule those records must respect is
[../CLEAN_ROOM.md](../CLEAN_ROOM.md).

| ADR                                                           | Title                                                                                                                             | Status   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)                 | Record architecture decisions                                                                                                     | accepted |
| [0002](0002-clean-room-policy.md)                             | Clean-room policy                                                                                                                 | accepted |
| [0003](0003-pure-typescript-de440s-ephemeris.md)              | Pure-TypeScript DE440s ephemeris                                                                                                  | accepted |
| [0004](0004-react-ui-in-apps.md)                              | React-based UI app under `apps/`                                                                                                  | proposed |
| [0005](0005-chartsession-worker-host.md)                      | ChartSession worker / SharedWorker host                                                                                           | proposed |
| [0006](0006-npm-packaging-and-ephemeris-data-distribution.md) | npm packaging and ephemeris data distribution                                                                                     | accepted |
| [0007](0007-modern-deltat-se210-black-box.md)                 | Modern ΔT vs SE 2.10 black-box                                                                                                    | accepted |
| [0008](0008-daily-motion-oracle-conventions.md)               | Daily motion oracle conventions                                                                                                   | accepted |
| [0009](0009-rise-set-horizon-and-high-latitude.md)            | Rise/set horizon and high latitude                                                                                                | accepted |
| [0010](0010-horizons-oracle-frame-gaps.md)                    | Horizons oracle frame gaps                                                                                                        | accepted |
| [0011](0011-de440-de441-composite-routing.md)                 | DE440 / DE441 composite routing                                                                                                   | accepted |
| [0012](0012-mean-lunar-node-long-range.md)                    | Mean lunar node outside 0–2150 CE                                                                                                 | accepted |
| [0013](0013-modern-deep-era-planet-residuals.md)              | Modern deep-era planet residuals (investigation)                                                                                  | accepted |
| [0014](0014-sidereal-o4-vs-vondrak-psigma.md)                 | Sidereal O4 vs Vondrák P_Σ                                                                                                        | accepted |
| [0015](0015-profile-spica-lahiri-ayanamsa.md)                 | Profile-specific Spica and Lahiri ayanamsa                                                                                        | accepted |
| [0016](0016-mean-lunar-node-elp-de441.md)                     | ELP/MPP02 + DE441 mean node (hybrid retains Meeus)                                                                                | accepted |
| [0017](0017-house-systems-clean-room.md)                      | Clean-room house systems (SE letters)                                                                                             | accepted |
| [0018](0018-extended-vargas-dashas-outer-planets.md)          | Extended vargas, dashas, outer planets                                                                                            | accepted |
| [0019](0019-gmst-long-term-join.md)                           | Sidereal time: IAU 2006 window and long-term join                                                                                 | accepted |
| [0020](0020-extended-dashas-kalachakra-jaimini-tajika.md)     | Extended dashas (Kalachakra, Jaimini, Tajika)                                                                                     | accepted |
| [0021](0021-heliocentric-equatorial-output.md)                | Heliocentric and equatorial planet output                                                                                         | accepted |
| [0022](0022-makransky-sunshine-wedge.md)                      | Makransky Sunshine wedge (SE letter `i`)                                                                                          | accepted |
| [0023](0023-geometric-parallax-long-range.md)                 | Geometric True Citra parallax outside DE440s                                                                                      | accepted |
| [0024](0024-cross-library-accuracy-benchmark.md)              | Cross-library ephemeris accuracy benchmark                                                                                        | accepted |
| 0030                                                          | Server-grade PR4 nutation/precession cache ([#336](https://github.com/harieshwar-ai/node-jhora/pull/336))                         | proposed |
| [0031](0031-subpath-exports-and-esm-only.md)                  | Subpath exports (chebyshev, vargas) and ESM-only (server-grade PR6, [#338](https://github.com/harieshwar-ai/node-jhora/pull/338)) | accepted |
| [0032](0032-server-grade-pr5-edge-long-range.md)              | Edge kernel and windowed NJCE (server-grade PR5, [#339](https://github.com/harieshwar-ai/node-jhora/pull/339))                    | accepted |
