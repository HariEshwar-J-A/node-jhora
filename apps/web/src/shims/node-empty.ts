export function existsSync(): boolean {
    return false;
}
export async function readFile(): Promise<never> {
    throw new Error('no fs in browser');
}
export function join(...parts: string[]): string {
    return parts.join('/');
}
export function dirname(): string {
    return '';
}
export function createRequire(): { resolve: () => never } {
    return {
        resolve: () => {
            throw new Error('no require in browser');
        },
    };
}
