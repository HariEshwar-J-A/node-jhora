import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

function routeSegment(pathname: string): string {
    const seg = pathname.replace(/^\/+/, '').split('/')[0];
    return seg || 'home';
}

export function PageTransition({ children }: { children: ReactNode }) {
    const location = useLocation();
    const reduce = useReducedMotion();
    const segment = routeSegment(location.pathname);
    const prevSegment = useRef(segment);

    useLayoutEffect(() => {
        if (reduce || prevSegment.current === segment) {
            prevSegment.current = segment;
            return;
        }
        prevSegment.current = segment;
        const doc = document as Document & {
            startViewTransition?: (cb: () => void) => { finished: Promise<void> };
        };
        if (typeof doc.startViewTransition !== 'function') return;
        doc.startViewTransition(() => {
            /* React already committed; native crossfade still runs on paint. */
        });
    }, [segment, reduce]);

    if (reduce) {
        return <div className="route-shell">{children}</div>;
    }

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={segment}
                className="route-shell"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
