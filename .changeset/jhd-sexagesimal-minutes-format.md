---
'@node-jhora/format': patch
---

Fix JHora `.jhd` sexagesimal packing on lines 4–7: fractional fields are decimal minutes ÷ 100 (not `HH.MMSS`). Adds round-trip coverage against the twelve-chart fictional fixture corpus.
