# `.jhd` chart files

Plain-text, one value per line (CRLF in JHora exports; LF is accepted on import).

## Header (lines 1–8)

| Line | Field |
| --- | --- |
| 1–3 | month, day, year |
| 4 | local time (packed sexagesimal `HH.MMSS`, not decimal hours) |
| 5 | time zone east of UTC, sign-flipped packed sexagesimal |
| 6 | longitude east, sign-flipped packed sexagesimal |
| 7 | latitude north, packed sexagesimal |
| 8 | **ambiguous** — see below |

## Line 8 ambiguity

Two file shapes share the same first eight lines:

1. **Modern** — line 8 is **altitude in kilometres** (decimal). Lines 9+ hold decimal TZ repeats, place index, name, country, and weather fields.
2. **Legacy** — line 8 is **not** altitude. It is an unrelated small scalar (often ≈ `0.97` in captured samples). Lines 9–17 are nine sidereal longitudes; line 18 is nine `0`/`1` retrograde flags.

The parser picks the variant from lines 9–18 (`detectJhdVariant`). By default, altitude is read only for the modern shape, converting km → metres (`altitudeMetres`).

Override with `line8Altitude` on `parseJhdDetailed`:

| Mode | Behaviour |
| --- | --- |
| `auto` | Modern → km; legacy → ignore line 8 for altitude |
| `kilometres` | Treat line 8 as km (×1000 to metres) |
| `metres` | Treat line 8 as metres |
| `ignore` | Never set `altitudeMetres` from line 8 |

## API

- Browser-safe: `@node-jhora/format/jhd` — `parseJhd`, `writeJhd`, `parseJhdDetailed`, …
- Node-only folder import: `@node-jhora/format/node` — `importJhdFolder`

Errors use `JhdParseError` with `line` and `code` when the failure is tied to a line.
