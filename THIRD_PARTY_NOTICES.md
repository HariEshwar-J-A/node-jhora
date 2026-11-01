# Third-party notices

This file records licences for redistributed third-party material that is
transcribed into the node-jhora source tree (not npm dependencies).

## ERFA (IAU 2000A nutation series)

The file `packages/core/src/engine/nutation-iau2000a.data.json` contains
coefficients transcribed from the ERFA library (https://github.com/liberfa/erfa),
which implements IAU Standards of Fundamental Astronomy. ERFA is BSD-3-licensed.

```
Copyright (C) 2013-2021, NumFOCUS Foundation.
All rights reserved.

This library is derived, with permission, from the International
Astronomical Union's "Standards of Fundamental Astronomy" library,
available from http://www.iausofa.org.

The ERFA version is intended to retain identical
functionality to the SOFA library, but made distinct through
different function and file names, as set out in the SOFA license
conditions. The SOFA original has a role as a reference standard
for the IAU and IERS, and consequently redistribution is permitted only
in its unaltered state. The ERFA version is not subject to this
restriction and therefore can be included in distributions which do not
support the concept of "read only" software.

Although the intent is to replicate the SOFA API (other than replacement of
prefix names) and results (with the exception of bugs; any that are
discovered will be fixed), SOFA is not responsible for any errors found
in this version of the library.

If you wish to acknowledge the SOFA heritage, please acknowledge that
you are using a library derived from SOFA, rather than SOFA itself.


TERMS AND CONDITIONS

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1 Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.

2 Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

3 Neither the name of the Standards Of Fundamental Astronomy Board, the
   International Astronomical Union nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

Runtime nutation code in `packages/core/src/engine/nutation-iau2000a.ts` follows
the same ERFA algorithms (nut00a, faom03, nut06a) under the same licence terms.

## JPL planetary ephemerides (DE440s / DE431 / DE441)

SPK kernels and Chebyshev segment data loaded from `@node-jhora/ephe`,
`@node-jhora/ephe-long`, and `@node-jhora/ephe441` are **U.S. Government works**
(NASA/JPL NAIF). See `packages/ephe/README.md` and `docs/guides/data-sources.md`.

## IERS Earth orientation parameters

Bulletin A/B data in `@node-jhora/eop` is © IERS and used under the IERS open-data
terms recorded in that package's README.

## Gaia / Hipparcos star catalogues

Star positions for true ayanamsa modes cite published catalogue values transcribed
in `packages/core/src/vedic/ayanamsa.ts` (see `@provenance` comments and ADR 0025).

## GeoNames (atlas)

City gazetteer data in `@node-jhora/atlas` is © GeoNames, used under **CC-BY 4.0**
(see `packages/atlas/README.md`).
