import { useEffect, useState } from 'react';
import { GlossyCard } from '../components/ui/GlossyCard';
import { NeonButton } from '../components/ui/NeonButton';
import { NodeJHora } from '@node-jhora/core';
import { DateTime } from 'luxon';
import { AnimatedSouthIndianChart, AnimatedNorthIndianChart } from '@node-jhora/ui-react';
import { ArrowRight, RotateCw, Calendar, Heart, MapPin, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { BirthInputForm } from '../components/BirthInputForm';
import type { BirthData } from '../components/BirthInputForm';

// Define types locally since Vite is having issues with the exports
interface PlanetPosition { id: number; name: string; longitude: number; latitude: number; distance: number; speed: number; declination: number; }
interface HouseData { cusps: number[]; ascendant: number; mc: number; armc: number; vertex: number; }
interface PanchangaResult {
    tithi: { name: string; index: number; phase: string };
    nakshatra: { name: string; index: number; entryDegree: number };
    yoga: { name: string; index: number };
    karana: { name: string; index: number };
}
interface ChartData { planets: PlanetPosition[]; houses: HouseData; ascendant: number; ayanamsa: string; panchanga: PanchangaResult | null; }

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [birthData, setBirthData] = useState<BirthData>({
        date: new Date(),
        timezone: 'Asia/Kolkata',
        location: { latitude: 28.61, longitude: 77.20, name: 'New Delhi, India' }
    });
    const [chartStyle, setChartStyle] = useState<'south' | 'north'>('south');

    useEffect(() => {
        initEngine();
    }, []);

    const initEngine = async () => {
        try {
            await NodeJHora.init();
            await calculate(birthData.date, birthData.location);
        } catch (e: any) {
            console.error("WASM Init Failed", e);
            setError(e.message || "Failed to initialize");
        } finally {
            setLoading(false);
        }
    };

    const calculate = async (date: Date, location: { latitude: number, longitude: number }) => {
        try {
            const data = await (NodeJHora.calculate(date, location, 'Lahiri', {
                topocentric: false,
                nodeType: 'true',
                ayanamsaOffset: 0.0818
            }) as unknown as Promise<ChartData>);
            setChartData(data);
            setError(null);
        } catch (e: any) {
            console.error("Calculation Failed", e);
            setError(e.message || "Calculation failed");
        }
    };

    const handleBirthDataUpdate = async (data: BirthData) => {
        setBirthData(data);
        await calculate(data.date, data.location);
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
            {/* Header Card */}
            <motion.div variants={item} className="md:col-span-3">
                <GlossyCard className="flex items-center justify-between bg-gradient-to-r from-slate-900/80 to-slate-800/80">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-white mb-2">Cosmic Dashboard</h1>
                        <p className="text-slate-400">Your personal command center for Vedic insights.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="text-right hidden md:flex flex-col justify-center">
                            <div className="flex items-center gap-2 text-amber-500 font-bold">
                                <Clock className="w-4 h-4" />
                                {DateTime.fromJSDate(birthData.date).setZone(birthData.timezone).toFormat('cccc, dd MMMM yyyy HH:mm')}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-xs mt-1">
                                <MapPin className="w-3 h-3" />
                                {birthData.location.name}
                            </div>
                        </div>
                        <NeonButton size="sm" variant="ghost" onClick={() => calculate(birthData.date, birthData.location)}>
                            <RotateCw className="w-4 h-4" />
                        </NeonButton>
                    </div>
                </GlossyCard>
            </motion.div>

            {/* Input Form Card */}
            <motion.div variants={item}>
                <BirthInputForm onCalculate={handleBirthDataUpdate} />

                <GlossyCard className="mt-6">
                    <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                        <NeonButton className="w-full justify-between group">
                            New Horoscope <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </NeonButton>
                        <NeonButton variant="secondary" className="w-full justify-between group">
                            Match Compatibility <Heart className="w-4 h-4 text-red-400" />
                        </NeonButton>
                    </div>
                </GlossyCard>
            </motion.div>

            {/* Main Chart Card */}
            <motion.div variants={item} className="md:col-span-2 row-span-2">
                <GlossyCard className="h-full min-h-[500px] flex flex-col relative group">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-white">Live Chart</h2>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 uppercase">{chartStyle} STYLE</span>
                        </div>
                        <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                            <button
                                onClick={() => setChartStyle('south')}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${chartStyle === 'south' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                South
                            </button>
                            <button
                                onClick={() => setChartStyle('north')}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${chartStyle === 'north' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                North
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center relative py-4">
                        {loading && <div className="animate-pulse text-slate-500">Initializing Engine...</div>}
                        {error && <div className="text-red-400 text-center p-4">{error}</div>}
                        {!loading && !error && chartData && (
                            <div className="w-full h-full flex items-center justify-center scale-95 md:scale-100">
                                <div className="absolute inset-0 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
                                {chartStyle === 'south' ? (
                                    <AnimatedSouthIndianChart
                                        planets={chartData.planets}
                                        ascendant={chartData.houses.ascendant}
                                        width={450}
                                        height={450}
                                        className="max-w-full max-h-[500px] text-slate-200"
                                    />
                                ) : (
                                    <AnimatedNorthIndianChart
                                        planets={chartData.planets}
                                        ascendant={chartData.houses.ascendant}
                                        width={450}
                                        height={450}
                                        className="max-w-full max-h-[500px] text-slate-200"
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </GlossyCard>
            </motion.div>

            {/* Panchanga / stats */}
            <motion.div variants={item}>
                <GlossyCard className="h-full bg-gradient-to-br from-purple-900/20 to-slate-900/60 border-purple-500/20">
                    <h3 className="text-lg font-bold text-purple-200 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-400" />
                        Panchanga
                    </h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Tithi', value: chartData?.panchanga?.tithi.name || '...' },
                            { label: 'Nakshatra', value: chartData?.panchanga?.nakshatra.name || '...' },
                            { label: 'Yoga', value: chartData?.panchanga?.yoga.name || '...' },
                            { label: 'Karana', value: chartData?.panchanga?.karana.name || '...' }
                        ].map((stat, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                <span className="text-slate-400">{stat.label}</span>
                                <span className="font-semibold text-slate-200">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </GlossyCard>
            </motion.div>

            {/* Planetary Positions List (Bottom Span) */}
            <motion.div variants={item} className="md:col-span-3">
                <GlossyCard>
                    <h3 className="text-lg font-bold text-white mb-4">Planetary Positions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
                        {chartData?.planets.map(p => (
                            <div key={p.id} className="p-3 rounded-xl bg-slate-900/50 border border-white/5 flex flex-col items-center text-center hover:border-amber-500/30 transition-colors">
                                <div className="font-bold text-amber-500 text-lg mb-1">{p.name.substring(0, 2)}</div>
                                <div className="text-xs text-slate-300">
                                    {Math.floor(p.longitude % 30)}° {Math.floor((p.longitude % 1) * 60)}'
                                </div>
                                <div className="text-[10px] text-slate-500 uppercase mt-1">
                                    {p.speed < 0 ? 'Retro' : 'Direct'}
                                </div>
                            </div>
                        ))}
                    </div>
                </GlossyCard>
            </motion.div>
        </motion.div>
    );
}
