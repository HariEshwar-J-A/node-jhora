/**
 * @node-jhora/ephe — entry point
 * Exports paths to Swiss Ephemeris .se1 data files.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to sepl_18.se1 (planets) on the local filesystem. */
export const SEPL_PATH = join(__dirname, 'sepl_18.se1');

/** Absolute path to semo_18.se1 (Moon) on the local filesystem. */
export const SEMO_PATH = join(__dirname, 'semo_18.se1');

/** Returns true if both SE data files are present. */
export function isAvailable() {
    return existsSync(SEPL_PATH) && existsSync(SEMO_PATH);
}
