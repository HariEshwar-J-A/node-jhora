/**
 * @node-jhora/ephe — entry point
 * Exports the filesystem path to de440s.bsp so the engine can locate it.
 *
 * Data: NASA/JPL DE440s — U.S. Government public domain.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync }    from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to de440s.bsp on the local filesystem. */
export const DE440S_PATH = join(__dirname, 'de440s.bsp');

/** Returns true if de440s.bsp is present and at least 30 MB. */
export function isAvailable() {
    if (!existsSync(DE440S_PATH)) return false;
    const { statSync } = await import('fs');
    return statSync(DE440S_PATH).size > 30 * 1024 * 1024;
}
