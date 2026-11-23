import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

function routeSegment(pathname: string): string {
    const seg = pathname.replace(/^\/+/, '').split('/')[0];
    return seg || 'home';
}

/**
 * The shell is a landmark and does not move on the first paint. A later
 * navigation fades opacity only, so the route change is not a layout animation
 * and the landing chunk does not import framer-motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
    const location = useLocation();
    const segment = routeSegment(location.pathname);
    const seen = useRef(false);
    const [entered, setEntered] = useState(false);

    useLayoutEffect(() => {
        if (!seen.current) {
            seen.current = true;
            return;
        }
        setEntered(false);
        const id = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(id);
    }, [segment]);

    return (
        <main className={entered ? 'route-shell route-shell--enter' : 'route-shell'}>
            {children}
        </main>
    );
}
