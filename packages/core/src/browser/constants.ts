// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/** Pinned DE440s metadata (mirrors packages/ephe/download.mjs and constants.mjs). */

export const DE440S_SHA256 = 'c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2';

export const DE440S_BYTES = 32_726_016;

export const DE440S_URLS = [
    'https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp',
    'https://ssd.jpl.nasa.gov/pub/eph/planets/bsp/de440s.bsp',
] as const;
