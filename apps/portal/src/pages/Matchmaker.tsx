import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { BirthInputForm } from '../components/BirthInputForm';
import type { BirthData } from '../components/BirthInputForm';
import { GlossyCard } from '../components/ui/GlossyCard';
import { NodeJHora } from '@node-jhora/core';
import { PoruthamMatch } from '@node-jhora/match';
import type { CompatibilityResult } from '@node-jhora/match';

export default function Matchmaker() {
    const [person1, setPerson1] = useState<BirthData | null>(null);
    const [person2, setPerson2] = useState<BirthData | null>(null);
    const [result, setResult] = useState<CompatibilityResult | null>(null);
    const [calculating, setCalculating] = useState(false);

    const getNakshatraData = (chartData: any) => {
        const moon = chartData.planets.find((p: any) => p.name === 'Moon');
        if (!moon) return null;
        
        const long = moon.longitude;
        const nakIndex = Math.floor(long / (360 / 27));
        const signIndex = Math.floor(long / 30) + 1; // 1-12
        return { nakIndex, signIndex };
    };

    const handleCalculate = async () => {
        if (!person1 || !person2) return;
        setCalculating(true);
        try {
            await NodeJHora.init();
            // Calculations are now more accurate because BirthInputForm 
            // provides a timezone-aware Date object.
            const data1 = await NodeJHora.calculate(person1.date, person1.location, 'Lahiri');
            const data2 = await NodeJHora.calculate(person2.date, person2.location, 'Lahiri');

            const p1Nak = getNakshatraData(data1);
            const p2Nak = getNakshatraData(data2);

            if (p1Nak && p2Nak) {
                // Conventional: match(boyNak, girlNak, boySign, girlSign)
                // Let's treat Person 1 as Boy and Person 2 as Girl for simplicity
                const matchResult = PoruthamMatch.match(p1Nak.nakIndex, p2Nak.nakIndex, p1Nak.signIndex, p2Nak.signIndex);
                setResult(matchResult);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCalculating(false);
        }
    };

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
            <motion.div variants={item}>
                <h1 className="text-3xl font-display font-bold text-white mb-2 flex items-center gap-3">
                    <Heart className="w-8 h-8 text-red-500 fill-red-500/20" />
                    Matchmaking
                </h1>
                <p className="text-slate-400">Discover cosmic compatibility between two individuals using the 10 Poruthams system.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div variants={item}>
                    <BirthInputForm 
                        onCalculate={(data) => setPerson1(data)} 
                        className="h-full border-blue-500/20"
                    />
                    <div className="mt-2 text-center text-xs text-blue-400 font-bold uppercase tracking-widest">Person 1</div>
                </motion.div>
                <motion.div variants={item}>
                    <BirthInputForm 
                        onCalculate={(data) => setPerson2(data)} 
                        className="h-full border-pink-500/20"
                    />
                    <div className="mt-2 text-center text-xs text-pink-400 font-bold uppercase tracking-widest">Person 2</div>
                </motion.div>
            </div>

            <motion.div variants={item} className="flex justify-center">
                <button
                    onClick={handleCalculate}
                    disabled={!person1 || !person2 || calculating}
                    className="px-12 py-4 bg-gradient-to-r from-red-600 to-pink-600 rounded-full font-bold text-white shadow-xl shadow-red-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center gap-3"
                >
                    {calculating ? (
                        <>
                            <Activity className="w-5 h-5 animate-pulse" />
                            Calculating...
                        </>
                    ) : (
                        <>
                            <Heart className="w-5 h-5" />
                            Check Compatibility
                        </>
                    )}
                </button>
            </motion.div>

            {result && (
                <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <GlossyCard className="md:col-span-1 flex flex-col items-center justify-center text-center py-12 bg-gradient-to-b from-white/5 to-transparent">
                        <div className="text-sm text-slate-400 mb-2 uppercase tracking-widest font-bold">Total Score</div>
                        <div className="text-6xl font-display font-black text-white mb-4">
                            {result.totalScore}<span className="text-2xl text-slate-500">/{result.maxTotal}</span>
                        </div>
                        <div className={`px-4 py-2 rounded-full font-bold text-sm ${result.isRecommended ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                            {result.isRecommended ? 'Highly Recommended' : 'Average Compatibility'}
                        </div>
                    </GlossyCard>

                    <GlossyCard className="md:col-span-2">
                        <h3 className="text-xl font-bold text-white mb-6">Detailed Kuta Analysis</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {result.matches.map((match) => (
                                <div key={match.name} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-start gap-4 hover:bg-white/10 transition-colors">
                                    <div className="mt-1">
                                        {match.isCompatible ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-500" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-200">{match.name}</span>
                                            <span className="text-xs text-slate-500">{match.score}/{match.maxScore}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">{match.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GlossyCard>
                </motion.div>
            )}
        </motion.div>
    );
}
