# Clean-room policy toward JHora

- Status: accepted
- Date: 2026-10-26
- Deciders: maintainers

Technical story: E22-S2-T1

## Context and Problem Statement

node-jhora aims at behavioural parity with Jagannatha Hora. JHora is freeware
with its own copyright. How do we use it as a reference without copying its
code, text, or assets into this repository?

## Decision Drivers

- Parity work needs numeric oracles and observed workflows.
- The repository must stay an independent implementation.
- Reviewers need a check that does not depend on memory.

## Considered Options

- No written policy; rely on reviewer judgement.
- A clean-room policy: observe behaviour and numbers, write everything else
  ourselves, and enforce the file-level rules in CI.
- Vendor or decompile JHora for reference inside the tree.

## Decision Outcome

Chosen option: "a clean-room policy", because it allows parity testing and
forbids copying the expression of JHora. The full rule is
[docs/CLEAN_ROOM.md](../CLEAN_ROOM.md). In short:

- No JHora code, decompiled output, help text, icons, images, fonts, or other
  assets.
- JHora numbers are allowed only as expected values in tests, with provenance.
- UI layout may follow general Jyotish conventions. Code, art, and wording are
  original.
- `npm run check:clean-room` (`tools/check-forbidden-assets.mjs`) fails the
  tree on help files (`.chm`, `.hlp`), `.ico` and `.bmp`, `.exe` and `.dll`,
  `.jhd` files outside the fixture allowlist, and the decompiler markers
  `Decompiled by`, `Ghidra`, and `undefined4`.

### Consequences

- Good, because capture work can land numbers without landing a JHora install.
- Good, because the guard is a single Node script with no extra dependencies.
- Bad, because the guard cannot see a paraphrased help paragraph. Reviewers
  still read wording.

## Pros and Cons of the Options

### Unwritten practice

- Good, because it costs nothing up front.
- Bad, because agents and new contributors will not see the boundary.

### Written clean-room policy plus a file guard

- Good, because the boundary is explicit and part of it is automatic.
- Bad, because prose similarity still needs a human reviewer.

### Vendoring JHora materials

- Good, because implementers could look the wording up locally.
- Bad, because it copies copyrighted expression into the repository.

## More Information

Provenance for classical texts, JPL Horizons, and Swiss Ephemeris
documentation is specified in [docs/CLEAN_ROOM.md](../CLEAN_ROOM.md). Swiss
Ephemeris as a dependency is rejected separately in
[ADR 0003](0003-pure-typescript-de440s-ephemeris.md).
