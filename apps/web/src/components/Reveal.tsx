import { type ReactNode, useEffect, useRef, useState } from 'react';

type RevealProps = {
    children: ReactNode;
    delay?: number;
    className?: string;
};

/** Content stays visible. The slide is CSS, so the landing page does not load framer-motion. */
export function Reveal({ children, delay = 0, className }: RevealProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [on, setOn] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                if (!entry?.isIntersecting) return;
                setOn(true);
                io.disconnect();
            },
            { rootMargin: '0px 0px -4% 0px' },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`${className ?? ''} ${on ? 'reveal' : ''}`.trim()}
            style={on ? { animationDelay: `${delay}s` } : undefined}
        >
            {children}
        </div>
    );
}
