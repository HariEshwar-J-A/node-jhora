/**
 * @node-jhora/ephe — entry point
 * Exports the filesystem path to de440s.bsp so the engine can locate it.
 *
 * Data: NASA/JPL DE440s — U.S. Government public domain.
 */
import { existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to de440s.bsp on the local filesystem. */
export const DE440S_PATH = join(__dirname, 'de440s.bsp');

/** Returns true if de440s.bsp is present and at least 30 MB. */
export function isAvailable() {
    if (!existsSync(DE440S_PATH)) return false;
    return statSync(DE440S_PATH).size > 30 * 1024 * 1024;
}
