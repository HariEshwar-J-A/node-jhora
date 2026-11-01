/** Strip control characters that could forge log lines (CodeQL log injection). */
export function sanitizeLogLine(value) {
    return String(value).replace(/[\r\n]/g, ' ');
}
