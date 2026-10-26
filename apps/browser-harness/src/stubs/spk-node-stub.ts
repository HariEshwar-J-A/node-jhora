/** Vite browser stub — the harness always loads DE440s from fetch / IndexedDB. */
export function loadSpk(): never {
    throw new Error('filesystem SPK load is unavailable in the browser harness');
}
