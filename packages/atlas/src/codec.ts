/**
 * Shard files are gzip-compressed JSON. A server that already sets
 * `Content-Encoding: gzip` hands `fetch` the inflated bytes, so the gzip
 * magic is checked and plain JSON still parses.
 */
export async function decodeJsonBytes(bytes: Uint8Array): Promise<unknown> {
    let payload = bytes;
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
        const copy = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(copy).set(bytes);
        const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('gzip'));
        payload = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return JSON.parse(new TextDecoder().decode(payload)) as unknown;
}
