# NJCE — Node-Jhora Compact Ephemeris chunk

Little-endian binary. Magic `NJCE` (`0x45434a4e`).

| Offset | Type   | Field                                                |
| ------ | ------ | ---------------------------------------------------- |
| 0      | u32    | magic                                                |
| 4      | u16    | version (=1)                                         |
| 6      | i32    | centuryIndex (`floor(astronomicalYear / 100)`)       |
| 10     | u8     | groupId (0 = planets+Sun vs SSB, 1 = EMB/Moon/Earth) |
| 11     | u8[3]  | padding                                              |
| 14     | u32    | numSegments                                          |
| 18+    | repeat | segment records                                      |

Each **segment**:

| Field        | Type                                    |
| ------------ | --------------------------------------- |
| target       | i32 NAIF id                             |
| center       | i32 NAIF id                             |
| INIT         | f64 ET seconds                          |
| INTLEN       | f64 seconds                             |
| RSIZE        | u32                                     |
| N            | u32                                     |
| padding      | 0–7 bytes (align next field to 8 bytes) |
| coefficients | N × RSIZE × f64                         |

Evaluation matches SPK Type-2 (`evalRecord` in `@node-jhora/core`).

**Error budget:** coefficients are transcribed from DE431; position error vs the source kernel is at float64 evaluation noise (well under **0.001″** at 1 AU). Sidereal chart accuracy in the deep past still depends on ΔT and precession follow-ups (hooks only in this release).
