import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Heart, FileText, Settings, Menu, X, Sparkles, Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { icon: LayoutDashboard, label: 'Cosmic View', path: '/' },
        { icon: Heart, label: 'Matchmaking', path: '/match' },
        { icon: FileText, label: 'Reports', path: '/reports' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <div className="flex h-screen bg-[#050510] text-slate-100 overflow-hidden font-sans selection:bg-amber-500/30">
            {/* Background Ambience */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-900/10 rounded-full blur-[120px]" />
                <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-blue-900/10 rounded-full blur-[100px]" />
            </div>

            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex w-64 flex-col border-r border-white/5 bg-slate-950/50 backdrop-blur-xl z-20 relative">
                <div className="p-6 flex items-center gap-3 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-display font-bold text-xl tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        AstroPortal
                    </span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                                isActive 
                                    ? "bg-amber-500/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)] border border-amber-500/20" 
                                    : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "fill-current" : "")} />
                                    <span className="font-medium">{item.label}</span>
                                    {isActive && (
                                        <motion.div 
                                            layoutId="activeNav"
                                            className="absolute left-0 w-1 h-8 bg-amber-500 rounded-r-full"
                                        />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 border border-white/5 relative overflow-hidden group hover:border-amber-500/20 transition-colors cursor-pointer">
                        <div className="relative z-10 flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center ring-2 ring-white/10">
                                <span className="text-xs font-bold text-slate-300">USR</span>
                           </div>
                           <div>
                               <div className="text-sm font-medium text-slate-200">User Profile</div>
                               <div className="text-xs text-slate-500">Free Plan</div>
                           </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                    <span className="font-display font-bold text-lg">AstroPortal</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </header>

            {/* Mobile Nav Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:hidden fixed inset-0 top-16 z-40 bg-slate-950 p-4"
                    >
                         <nav className="space-y-2">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={({ isActive }) => cn(
                                        "flex items-center gap-3 px-4 py-4 rounded-xl",
                                        isActive ? "bg-amber-500/10 text-amber-400" : "text-slate-400"
                                    )}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 overflow-y-auto overflow-x-hidden md:p-8 p-4 pt-20 md:pt-8 scrollbar-thin scrollbar-thumb-amber-500/20 scrollbar-track-transparent">
                <div className="max-w-7xl mx-auto space-y-8">
                     <Outlet />
                </div>
            </main>
        </div>
    );
}
