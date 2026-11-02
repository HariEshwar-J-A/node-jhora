export const INTRO_SESSION_KEY = 'njh-space-intro';

export function detectWebGL(): boolean {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
        return false;
    }
}
