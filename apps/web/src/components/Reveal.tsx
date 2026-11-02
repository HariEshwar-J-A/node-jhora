import { type ReactNode, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

type RevealProps = {
    children: ReactNode;
    delay?: number;
    className?: string;
};

/** Content is always visible; motion is optional slide-in only. */
export function Reveal({ children, delay = 0, className }: RevealProps) {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const inView = useInView(ref, { once: true, margin: '0px 0px -4% 0px' });

    if (reduce) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            ref={ref}
            className={className}
            initial={{ opacity: 1, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 1, y: 16 }}
            transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
        >
            {children}
        </motion.div>
    );
}
