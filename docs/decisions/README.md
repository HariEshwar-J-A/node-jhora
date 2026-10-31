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

| ADR                                                           | Title                                         | Status   |
| ------------------------------------------------------------- | --------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)                 | Record architecture decisions                 | accepted |
| [0002](0002-clean-room-policy.md)                             | Clean-room policy                             | accepted |
| [0003](0003-pure-typescript-de440s-ephemeris.md)              | Pure-TypeScript DE440s ephemeris              | accepted |
| [0004](0004-react-ui-in-apps.md)                              | React-based UI app under `apps/`              | proposed |
| [0005](0005-chartsession-worker-host.md)                      | ChartSession worker / SharedWorker host       | proposed |
| [0006](0006-npm-packaging-and-ephemeris-data-distribution.md) | npm packaging and ephemeris data distribution | accepted |
| [0007](0007-modern-deltat-se210-black-box.md)                 | Modern ΔT vs SE 2.10 black-box                | accepted |
| [0008](0008-daily-motion-oracle-conventions.md)               | Daily motion oracle conventions               | accepted |
| [0009](0009-rise-set-horizon-and-high-latitude.md)            | Rise/set horizon and high latitude            | accepted |
| [0010](0010-horizons-oracle-frame-gaps.md)                    | Horizons oracle frame gaps                    | accepted |
