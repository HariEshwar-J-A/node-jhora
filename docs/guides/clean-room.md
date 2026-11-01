# Clean-room policy

node-jhora is an independent clean-room implementation of Vedic astrology
(Jyotish) calculations and a user interface for them. Jagannatha Hora (JHora)
by P.V.R. Narasimha Rao is a behavioural reference: we may study what the
program _does_ and which numbers it prints. We do not copy how it is built.

This policy is binding. [ADR 0002](../decisions/0002-clean-room-policy.md) records
the decision. `pnpm run check:clean-room` enforces the mechanical part.

## What must never enter the repository

Do not commit any of the following, from a JHora install, a decompiler, a
disassembler, or a screenshot of JHora's own text:

- Source, bytecode, or decompiled output (including JD-GUI, Ghidra, IDA,
  dnSpy, or similar listings).
- Help-file text (`.chm`, `.hlp`, or a transcription of JHora help or menus).
- Icons, images, fonts, cursors, or other assets shipped with JHora
  (including `.ico` and `.bmp`).
- Binaries and libraries (`.exe`, `.dll`, and the same kinds of file under
  another name).
- Strings lifted from JHora's UI, reports, or documentation. Wording in this
  repo is original.

A file that merely _mentions_ JHora (a citation, a test name, this policy)
is fine. A file that _contains_ JHora's expression of an idea is not.

## What JHora output may be used for

JHora's **numeric** outputs may be used only as test oracles: expected values
in golden tests. They are observations, not source.

When a golden fixture records a JHora number:

- Store the literal sexagesimal string JHora displayed, plus the decimal the
  test compares, when the UI showed one.
- Note provenance in the fixture header (see below).
- Do not commit a raw export from a JHora install except a `.jhd` chart file
  placed under an allowlisted fixture directory. Those files are data, not
  code. Allowed locations:
    - `packages/<package>/tests/fixtures/**/*.jhd`
    - `test-fixtures/**/*.jhd`
- Prefer a small transcribed fixture over a large captured directory. Capture
  pipelines (Wine or otherwise) stay outside the repo and commit numbers only.

`.jhd` files anywhere else fail `pnpm run check:clean-room`.

## User interface

The UI may follow general conventions of Vedic astrology software: north,
south, and east Indian charts, planet tables, dasha trees, and similar
information layout. Layout conventions are not copyrightable expression.

The implementation must be original in code, art, and wording:

- Draw charts with our own SVG (or other code we wrote). Do not trace JHora
  bitmaps.
- Icons and glyphs are drawn for this project, or taken from a properly
  licensed original set (for example an OFL font or a MIT icon set) with the
  licence recorded.
- Labels, tooltips, and help text are written here. Do not paraphrase JHora
  help closely enough that the sentence is still theirs.

## How to record provenance

Every reference value that did not come from this engine needs a provenance
note next to the data: a fixture header comment, a field in the golden JSON,
or a short comment on the assertion. The note answers four questions: **what
was consulted, which edition or version, which passage or settings, and what
was transcribed versus computed.**

### JHora numeric oracle

```text
Source: JHora 8.0 screen export, read by hand on 2026-10-26.
Chart: 2000-01-01, 12:00, Chennai (51N28, 0W00), timezone as recorded.
Settings: True Chitrapaksha (mode 27), geometric positions, true node.
Transcribed: Moon "24 Ge 30' 39.61"" (the DMS string is JHora's).
Not copied: no binary, help text, or UI string.
```

If the number was read from a `.jhd` line, say so and give the path under the
allowlist. Legacy `.jhd` files embed an older program's longitudes; say which
generation of file it is so a later reader does not treat it as a fresh oracle.

### Published classical texts

Cite the work, author, edition, and location (chapter, verse, or page).
Summarise rules in our own words. Do not paste a copyrighted translation.
A short quotation from a public-domain edition is acceptable when the citation
includes the edition and the quote is no longer than the passage needed to
identify the rule.

```text
Source: Brihat Parashara Hora Shastra, Santhanam ed. (1984), ch. 6, v. 7–8.
Use: D2 hora sign assignment, paraphrased. Sanskrit verse not reproduced.
```

### JPL and Swiss Ephemeris documentation

JPL planetary ephemerides are U.S. Government public-domain data. The kernel
is fetched by `@node-jhora/ephe`; it is not a JHora asset. Cite the kernel and
the Horizons settings when a fixture pins astrometry:

```text
Source: JPL Horizons (DE440), geometric geocentric ecliptic longitude.
Settings: date 2000-01-01 TT, no light-time, output QUANTITIES as recorded
in packages/core/tests/fixtures/horizons_golden.ts.
```

Swiss Ephemeris documentation may be cited for an algorithm's public
description (precession model, house-cusp formula, ΔT series). Record the
document title and section. Do **not** vendor Swiss Ephemeris source, data
files, or WASM into this repository. Swiss Ephemeris is AGPL-3.0 and stays an
external oracle in developer or CI scripts only. See
[ADR 0003](../decisions/0003-pure-typescript-de440s-ephemeris.md).

### Engine snapshots

`reference_charts.ts` and similar files are this engine's own output. Label
them as regression snapshots, not as external oracles, and name the engine
version that produced them.

## What reviewers check

On every pull request:

1. `pnpm run check:clean-room` passes. The script fails the tree when it finds
   `.chm`, `.hlp`, `.ico`, `.bmp`, `.exe`, or `.dll` files; a `.jhd` file
   outside the fixture allowlist; or the decompiler markers `Decompiled by`,
   `Ghidra`, and `undefined4`.
2. New or changed golden numbers have a provenance note, including the JHora
   version and the settings that produced the number.
3. The diff adds no JHora help text, menu labels, fonts, icons, or images.
4. UI changes are original in code, art, and wording, even when the layout
   follows a common Jyotish convention.
5. No Swiss Ephemeris (or other AGPL) code or data was added as a dependency
   of a published package. An external oracle script must say that it shells
   out to a tool that is not shipped.
6. The policy files that name the forbidden markers
   (`docs/guides/clean-room.md`, `docs/decisions/0002-clean-room-policy.md`,
   `tools/check-forbidden-assets.mjs`, and its test) are not used to hide
   copied material. Reviewers read those diffs in full. The checker exempts
   them only so the policy can name the markers it searches for.

## Running the check

```bash
pnpm run check:clean-room
node --test tools/check-forbidden-assets.test.mjs
```

`pnpm test` runs the guard's unit tests after Jest. The unit tests build a
temporary tree; they do not need a JHora install.
