import { StatCard } from '../ui/StatCard';

type Panchanga = {
    tithi?: { name: string; percent?: number };
    nakshatra?: { name: string; pada: number; percent?: number };
    yoga?: { name: string };
    karana?: { name: string };
    vara?: { name: string };
};

type Props = {
    panchanga: Panchanga;
    sunRiseSet?: { rise?: string; set?: string };
};

export function PanchangaPanel({ panchanga, sunRiseSet }: Props) {
    return (
        <div className="panchanga-panel" data-testid="panel-panchanga">
            <div className="stat-grid">
                <StatCard label="Tithi" value={panchanga.tithi?.name ?? '—'} />
                <StatCard
                    label="Nakshatra"
                    value={panchanga.nakshatra?.name ?? '—'}
                    hint={panchanga.nakshatra ? `Pada ${panchanga.nakshatra.pada}` : undefined}
                />
                <StatCard label="Yoga" value={panchanga.yoga?.name ?? '—'} />
                <StatCard label="Karana" value={panchanga.karana?.name ?? '—'} />
                <StatCard label="Vara" value={panchanga.vara?.name ?? '—'} />
            </div>
            {sunRiseSet && (
                <div className="card" style={{ marginTop: '1rem' }}>
                    <h3>Sun rise / set</h3>
                    <div className="stat-grid">
                        <StatCard label="Sunrise" value={String(sunRiseSet.rise ?? '—')} />
                        <StatCard label="Sunset" value={String(sunRiseSet.set ?? '—')} />
                    </div>
                </div>
            )}
        </div>
    );
}
