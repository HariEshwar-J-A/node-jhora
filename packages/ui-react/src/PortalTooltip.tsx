import React from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  content: React.ReactNode;
}

export const PortalTooltip: React.FC<TooltipProps> = ({ visible, x, y, content }) => {
  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
           initial={{ opacity: 0, scale: 0.8, y: 10 }}
           animate={{ 
             opacity: 1, 
             scale: 1, 
             y: 0, 
             x: x + 15, // Offset to right
             top: y + 15  // Offset to bottom
           }}
           exit={{ opacity: 0, scale: 0.8 }}
           transition={{ type: "spring", stiffness: 300, damping: 20 }}
           style={{
             position: 'fixed', // Fixed to viewport
             // top/left handled by animate to allow smooth spring movement if we used useSpring-based values, 
             // but here we are using simple props. For "magnetic" feel we'd need useSpring, 
             // but prop-based animation is decent for "following".
             // Actually, 'animate' prop updates will trigger spring transition to new x/y.
             zIndex: 9999,
             pointerEvents: 'none',
             left: 0, // Reset to allow 'x' in transform or animate to work
             top: 0,
             backgroundColor: 'rgba(20, 20, 30, 0.95)',
             color: '#fff',
             padding: '8px 12px',
             borderRadius: '8px',
             fontSize: '12px',
             boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
             backdropFilter: 'blur(10px)',
             border: '1px solid rgba(255,255,255,0.1)',
             minWidth: '120px'
           }}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
