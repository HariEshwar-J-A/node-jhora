# BPHS Varga Audit

Every divisional chart in `packages/core/src/vedic/vargas.ts`, checked against
the text rather than against another implementation.

**Source:** Brihat Parasara Hora Sastra, tr. R. Santhanam (Ranjan Publications),
chapter 6, *The Sixteen Divisions Of A Sign*. Citations are to the sloka numbers
as printed in that edition.

**Why this audit exists.** BPHS is the authority for *rules*; JPL is the
authority for *astronomy*; the ayanamsa is a named choice. Conflating those is
how this project previously ended up with an engine that reproduced another
program's quirks and called it correctness. Two vargas turned out to follow a
different source than the text.

---

## Findings

| Varga | BPHS rule (sloka) | Implementation | Verdict |
|---|---|---|---|
| **D1** Rasi | — | identity | ✅ |
| **D2** Hora | 5-6 | *was* Parivritti Dwaya | ⚠️ **corrected** — see below |
| **D3** Drekkana | 7-8 | offsets 1st/5th/9th | ✅ |
| **D4** Chaturthamsa | 9 | offsets 1st/4th/7th/10th | ✅ |
| **D7** Saptamsa | 10-11 | odd → itself, even → 7th | ✅ |
| **D9** Navamsa | 12 | harmonic ×9 | ✅ equivalent |
| **D10** Dasamsa | 13-14 | odd → itself, even → 9th | ✅ **default corrected** |
| **D12** Dvadasamsa | 15 | from the same sign | ✅ |
| **D16** Shodasamsa | 16 | Ar / Le / Sg by movable-fixed-dual | ✅ |
| **D20** Vimsamsa | 17-21 | Ar / Sg / Le | ✅ |
| **D24** Siddhamsa | 22-23 | odd → Leo, even → Cancer | ✅ |
| **D27** Bhamsa | 24-26 | element-based start | ✅ |
| **D30** Trimsamsa | 27-28 | 5/5/8/7/5 Ma-Sa-Ju-Me-Ve, reversed for even | ✅ |
| **D40** Khavedamsa | 29-30 | odd → Aries, even → Libra | ✅ |
| **D45** Akshavedamsa | 31-32 | Ar / Le / Sg | ✅ |
| **D60** Shashtiamsa | 33-41 | deg ×2, ÷12, remainder +1 | ✅ |

Fourteen of sixteen matched the text as written. Two did not.

---

## D2 Hora — corrected

> **BPHS 5-6:** "The first half of an odd sign is the Hora ruled by the Sun while
> the second half is the Hora of the Moon. The reverse is true in the case of an
> even sign."

The Sun's sign is Leo and the Moon's is Cancer, so **a D2 position can only ever
be Leo or Cancer**. There are two possible D2 signs, not twelve.

The previous implementation mapped `signIdx * 2 + hora` across all twelve signs.
Its own source comment said where that came from:

```
// PyJHora uses __parivritti_even_reverse(dcf=2):
```

It was ported from another program, not from Parashara. That is the Parivritti
Dwaya scheme — a real scheme with its own following, but not the one BPHS
describes.

**Now:** `horaScheme: 'parashara'` is the default; `'parivritti'` reproduces the
old behaviour.

```ts
calculateVarga(lon, 2);                                  // Leo or Cancer
calculateVarga(lon, 2, { horaScheme: 'parivritti' });    // all twelve signs
```

## D10 Dasamsa — default corrected

> **BPHS 13-14:** दशमांशाः स्वतश्च ओजे युग्मे तन्नवमात् स्मृताः
> — "The Dasamsas in an odd sign are from itself; in an even sign, from the
> ninth thereof."

JHora prints this chart's D10 under the header **"D-10 (5-8)"**, which counts an
even sign's parts *backward from the 5th sign* with the degree reversed. That is
not the BPHS rule. Measured against a real JHora export, all five bodies in odd
signs agree under either rule and all five in even signs agree only under
JHora's — and for every even-sign body, Parashara degree + JHora degree = exactly
30.000°, which is the reversal showing through.

**Now:** `dasamsaScheme: 'parashara'` is the default; `'jhora_5_8'` reproduces
JHora.

---

## Notes on the ones that passed

**D9 Navamsa** is implemented as the harmonic `lon × 9`, not as an explicit
movable/fixed/dual start table. These are equivalent, and the source documents
the proof: a movable sign starts at itself (0° × 9 = Aries), a fixed sign lands
on the 9th (30° × 9 = 270° = Capricorn, the 9th from Taurus), a dual sign on the
5th (60° × 9 = 540° mod 360 = 180° = Libra, the 5th from Gemini). Verified
against JHora's D9 for all nine bodies to 0.1″.

**D30 Trimsamsa** uses unequal bounds (5°, 5°, 8°, 7°, 5°) rather than 1° parts,
per sloka 27-28, and reverses both the quantum and the lordship for even signs.

**D60 Shashtiamsa** follows the arithmetic in sloka 33-41 literally rather than
treating it as a 60-part division, which matters at sign boundaries.

---

## Limitations

The source is OCR'd from print and is damaged in places. Only 24 of the roughly
97 chapter headings survive as parseable text, which is why
`JyotishBase/structured_data/bphs_units.json` marks chapter numbers with a
`chapter_confidence` field rather than asserting them. Sloka numbers survive far
better — 1198 Devanagari verse markers are intact — so citations here are to
sloka numbers within the Shodasavarga chapter, which were read directly.

Deity lists (Shashtiamsa's 60 names, Vimsamsa's 20, Bhamsa's 27) were **not**
audited character by character; several are visibly OCR-damaged in the source
(`Mahes-25. Deva`, `Bhishma` where `Bhima` is expected). They do not affect
computed positions.

The Sharma volumes in `kb-general/` are not yet converted to markdown, so this
audit rests on Santhanam alone. A second translation would be the natural way to
resolve the passages where OCR leaves the reading uncertain.
