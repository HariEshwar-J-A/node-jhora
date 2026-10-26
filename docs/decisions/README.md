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

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | accepted |
| [0002](0002-clean-room-policy.md) | Clean-room policy | accepted |
| [0003](0003-pure-typescript-de440s-ephemeris.md) | Pure-TypeScript DE440s ephemeris | accepted |
| [0004](0004-react-ui-in-apps.md) | React-based UI app under `apps/` | proposed |
