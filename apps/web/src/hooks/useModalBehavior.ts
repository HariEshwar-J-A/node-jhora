import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

let lockCount = 0;

/** Reference-counted page scroll lock (nested overlays unlock only when the last one closes). */
export function lockPageScroll(): () => void {
    if (lockCount++ === 0) document.documentElement.classList.add('scroll-locked');
    let released = false;
    return () => {
        if (released) return;
        released = true;
        if (--lockCount === 0) document.documentElement.classList.remove('scroll-locked');
    };
}

function focusables(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
    );
}

/**
 * Dialog behaviour for drawers and sheets: Esc closes, Tab stays inside the
 * panel, the page behind does not scroll, and focus returns to the opener.
 * An Esc that a child already handled (for example a combobox closing its
 * list) is left alone because that child calls preventDefault().
 */
export function useModalBehavior(
    active: boolean,
    panelRef: RefObject<HTMLElement | null>,
    onClose: () => void,
) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        if (!active) return;
        const panel = panelRef.current;
        if (!panel) return;
        const opener =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const unlock = lockPageScroll();

        const preferred = panel.querySelector<HTMLElement>('[data-autofocus]');
        (preferred ?? focusables(panel)[0] ?? panel).focus({ preventScroll: true });

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (event.defaultPrevented) return;
                event.preventDefault();
                closeRef.current();
                return;
            }
            if (event.key !== 'Tab') return;
            const items = focusables(panel);
            if (items.length === 0) {
                event.preventDefault();
                panel.focus();
                return;
            }
            const first = items[0]!;
            const last = items[items.length - 1]!;
            const current = document.activeElement;
            if (!panel.contains(current)) {
                event.preventDefault();
                first.focus();
            } else if (event.shiftKey && (current === first || current === panel)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && current === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            unlock();
            if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
        };
    }, [active, panelRef]);
}
