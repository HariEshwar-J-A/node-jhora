import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalBehavior } from '../../hooks/useModalBehavior';

type Props = {
    open: boolean;
    onClose: () => void;
    /** Edge the panel slides in from. */
    side?: 'left' | 'right';
    title: string;
    closeLabel: string;
    className?: string;
    children: ReactNode;
};

const EXIT_MS = 240;

export function CloseIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
            />
        </svg>
    );
}

/**
 * Off-canvas panel with a dimmed, tappable backdrop. Rendered in a portal so
 * no transformed ancestor can trap its `position: fixed`. Esc, backdrop tap
 * and the close button dismiss it; focus is trapped while open and the page
 * behind is locked from scrolling.
 */
export function Drawer({
    open,
    onClose,
    side = 'left',
    title,
    closeLabel,
    className,
    children,
}: Props) {
    const [mounted, setMounted] = useState(open);
    const [shown, setShown] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    useEffect(() => {
        if (open) {
            setMounted(true);
            let inner = 0;
            const outer = requestAnimationFrame(() => {
                inner = requestAnimationFrame(() => setShown(true));
            });
            return () => {
                cancelAnimationFrame(outer);
                cancelAnimationFrame(inner);
            };
        }
        setShown(false);
        const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
        return () => window.clearTimeout(timer);
    }, [open]);

    useModalBehavior(open && mounted, panelRef, onClose);

    if (!mounted) return null;
    return createPortal(
        <div
            className={`drawer drawer--${side}${shown ? ' drawer--open' : ''}${className ? ` ${className}` : ''}`}
        >
            <button
                type="button"
                className="drawer__backdrop"
                tabIndex={-1}
                aria-label={closeLabel}
                onClick={onClose}
            />
            <div
                ref={panelRef}
                className="drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="drawer__head">
                    <h2 id={titleId} className="drawer__title">
                        {title}
                    </h2>
                    <button
                        type="button"
                        className="icon-btn drawer__close"
                        aria-label={closeLabel}
                        onClick={onClose}
                    >
                        <CloseIcon />
                    </button>
                </div>
                <div className="drawer__body">{children}</div>
            </div>
        </div>,
        document.body,
    );
}
