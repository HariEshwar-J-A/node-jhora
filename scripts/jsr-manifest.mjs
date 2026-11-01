/**
 * JSR publish targets and npm-only data/tool packages (see docs/guides/releasing.md).
 */

/** Package directory names under packages/ that publish to JSR (@node-jhora/<dir>). */
export const JSR_PUBLISHABLE = [
    'analytics',
    'api',
    'atlas',
    'core',
    'engine',
    'events',
    'format',
    'match',
    'prediction',
    'reporting',
];

/** @type {Record<string, string>} */
export const JSR_NPM_ONLY_REASONS = {
    ephe: 'Ships the DE440s BSP kernel (~31 MB unpacked). JSR per-package size limits make this npm-only; Deno/Bun use npm:@node-jhora/ephe.',
    eop: 'Ships a binary Earth-orientation kernel. Published on npm only; JSR consumers use npm:@node-jhora/eop.',
    ephe441:
        'DE441 chunk build/metadata tooling tied to large npm chunk packages — not a runtime library on JSR.',
    'ephe-long':
        'DE431 long-range chunk build/metadata tooling tied to large npm chunk packages — not on JSR.',
};

/** All non-private workspace packages (npm publish set). */
export const NPM_PUBLISHABLE = [
    'analytics',
    'api',
    'atlas',
    'core',
    'engine',
    'eop',
    'ephe',
    'ephe441',
    'ephe-long',
    'events',
    'format',
    'match',
    'prediction',
    'reporting',
];
