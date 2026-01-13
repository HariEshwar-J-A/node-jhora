import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface GlossyCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    intensity?: 'low' | 'medium' | 'high';
}

export const GlossyCard: React.FC<GlossyCardProps> = ({ 
    children, 
    className, 
    intensity = 'medium',
    ...props 
}) => {
    const bgOpacity = {
        low: 'bg-slate-900/40',
        medium: 'bg-slate-900/60',
        high: 'bg-slate-900/80'
    };

    return (
        <motion.div 
            whileHover={{ scale: 1.01 }}
            className={cn(
                "relative overflow-hidden rounded-2xl border border-white/10 backdrop-blur-md shadow-xl",
                bgOpacity[intensity],
                className
            )}
            {...props}
        >
            {/* Inner Glow Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            
            {/* Content */}
            <div className="relative z-10 p-6">
                {children}
            </div>
            
            {/* Border Glow on Hover */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </motion.div>
    );
};
