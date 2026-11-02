import { type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export function AnimatedTabPanel({ tabKey, children }: { tabKey: string; children: ReactNode }) {
    const reduce = useReducedMotion();

    if (reduce) {
        return <div data-tab-panel={tabKey}>{children}</div>;
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={tabKey}
                data-tab-panel={tabKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
