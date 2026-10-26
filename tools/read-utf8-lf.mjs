import { readFileSync } from 'node:fs';

/** Read a UTF-8 text file and normalize CRLF to LF (Windows checkout safety). */
export function readUtf8Lf(path) {
    return readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
}
