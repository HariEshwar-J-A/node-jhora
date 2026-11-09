/**
 * Public mount of the marketing site. Import this from Vite, Playwright,
 * and the static-file generator. Do not hardcode the path anywhere else.
 */
import { DE440S_SHA256 } from '../../packages/ephe/constants.mjs';

/** Always starts and ends with a slash. */
export const SITE_BASE_PATH = '/astrology/';

export const SITE_ORIGIN = 'https://harieshwar.dev';

/** Canonical URL without a trailing slash. */
export const SITE_CANONICAL = `${SITE_ORIGIN}${SITE_BASE_PATH.replace(/\/$/, '')}`;

/**
 * Kernel filename includes the first 12 hex of the pinned SHA-256 so an
 * immutable cache entry dies when the pin changes. The worker still checks
 * the full digest of the bytes.
 */
export const KERNEL_FILENAME = `de440s.${DE440S_SHA256.slice(0, 12)}.bsp`;

export function previewOrigin(port = 4173) {
    return `http://127.0.0.1:${port}${SITE_BASE_PATH}`;
}
