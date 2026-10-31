# 0020. Extended dashas: Kalachakra, Jaimini rasi, Tithi Ashtottari, Tajika Patyayini

Date: 2026-10-31

## Status

Accepted

## Context

The 2026-10-31 coverage audit listed missing dasha systems versus JHora’s catalog:
Kalachakra, full Moola and Sudasa, Tithi-based Ashtottari, Drig, and Patyayini. Prior
`MoolaDasha` / `SudasaDasha` / `KalachakraDasha` were placeholders or simplified helpers
(ADR 0018).

## Decision

Implement clean-room algorithms from published prose only:

| System                       | Source                                                                                    | Module                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| Kalachakra nine-rashi run    | BPHS ch. 46 vv. 56–95; Phaladeepika ch. 22 vv. 5–7; whole-cycle paramayus balance (v. 93) | `kalachakra.ts`, `kalachakra-tables.ts` |
| Moola (Lagna kendradi graha) | Sanjay Rath, Moola Dasa (mulatrikona reduction ± exalt/debil, two cycles)                 | `special.ts`, `jaimini-rasi-dasa.ts`    |
| Sudasa (Śrī Lagna kendradi)  | Sanjay Rath / IndiaDivine Sudasa lesson (SL fraction, Saturn/Ketu exceptions)             | `special.ts`                            |
| Drig dasa                    | Jaimini 2.4.21; trines from 9th/10th/11th; chara years (Parasara engine convention)       | `special.ts`                            |
| Tithi Ashtottari             | Vedavyasa / IndiaDivine TA tutorial (tithi lords, 108 y cycle)                            | `special.ts`                            |
| Patyayini                    | Tajika annual krishamsa (Tag-to-Adawal; Vishal Aksh Patyanshi formulas)                   | `special.ts`                            |

Kalachakra schedules **do not** advance into the next nakshatra pada when the paramayus
run completes (JHora / BPHS convention noted in Lumin Kalachakra spread documentation).

## Consequences

- `@node-jhora/prediction` exports `KalachakraDasha`, `DrigDasha`, `PatyayiniDasha`,
  `generateTithiAshtottari`, and full `MoolaDasha` / `SudasaDasha`.
- ADR 0018 placeholder note superseded for these systems.
- Golden tests remain chart-oracle based; unit tests pin table arithmetic only.

## References

- Parashara, _Brihat Parashara Hora Shastra_ ch. 46 (Kalachakra, vv. 56–95)
- Mantreshwara, _Phaladeepika_ ch. 22 (Kalachakra pada templates)
- Sanjay Rath, Moola Dasa and Sudasa lessons (published web articles)
- P.V.R. Narasimha Rao, Kalachakra paramayus depletion article
- Vedavyasa / IndiaDivine, Tithi Ashtottari tutorial
- Tag-to-Adawal / Vishal Aksh, Patyayini (Patyanshi) annual dasa
