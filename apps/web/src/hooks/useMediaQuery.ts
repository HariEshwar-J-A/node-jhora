import { useEffect, useState } from 'react';

/** Live `matchMedia` result. Reads synchronously on first render so layout never flashes. */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() =>
        typeof window === 'undefined' ? false : window.matchMedia(query).matches,
    );
    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = () => setMatches(mql.matches);
        onChange();
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);
    return matches;
}

/** Breakpoints shared by CSS (styles.css) and the components that swap markup. */
export const MQ_NAV_COMPACT = '(max-width: 820px)';
export const MQ_DOCS_COMPACT = '(max-width: 860px)';
export const MQ_SHEET = '(max-width: 900px)';
