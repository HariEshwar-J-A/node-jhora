import { useEffect } from 'react';

/**
 * While `active`, mirrors the visual viewport (the part of the screen not
 * covered by the on-screen keyboard) into `--vv-height` and `--vv-bottom` on
 * <html>, so a bottom sheet can sit above the keyboard on iOS (where the
 * layout viewport does not shrink) and never grows taller than what is visible.
 */
export function useVisualViewportVars(active: boolean) {
    useEffect(() => {
        const vv = window.visualViewport;
        if (!active || !vv) return;
        const root = document.documentElement;
        const update = () => {
            root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
            const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            root.style.setProperty('--vv-bottom', `${Math.round(bottom)}px`);
        };
        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
            root.style.removeProperty('--vv-height');
            root.style.removeProperty('--vv-bottom');
        };
    }, [active]);
}
