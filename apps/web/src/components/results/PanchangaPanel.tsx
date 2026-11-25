import { StatCard } from '../ui/StatCard';
import { useI18n, type Translate } from '../../i18n';
import {
    karanaName,
    nakshatraFromEnglish,
    panchangaYogaName,
    tithiLabel,
    varaName,
} from '../../i18n/astro';

type Panchanga = {
    tithi?: { index?: number; name: string; percent?: number };
    nakshatra?: { index?: number; name: string; pada: number; percent?: number };
    yoga?: { index?: number; name: string };
    karana?: { index?: number; name: string };
    vara?: { index?: number; name: string };
};

type Props = {
    panchanga: Panchanga;
    sunRiseSet?: { rise?: string; set?: string };
    riseSetNote?: string;
};

/** The worker sends HH:mm:ss or one of two English polar notes. */
function riseSetText(value: string | undefined, t: Translate): string {
    if (value == null) return '—';
    if (value === 'No set (polar day)') return t('panchanga.polarDay');
    if (value === 'No rise (polar night)') return t('panchanga.polarNight');
    return String(value);
}

export function PanchangaPanel({ panchanga, sunRiseSet, riseSetNote }: Props) {
    const { lang, t } = useI18n();
    return (
        <div className="panchanga-panel" data-testid="panel-panchanga">
            <div className="stat-grid">
                <StatCard
                    label={t('panchanga.tithi')}
                    value={panchanga.tithi ? tithiLabel(panchanga.tithi, lang) : '—'}
                />
                <StatCard
                    label={t('panchanga.nakshatra')}
                    value={
                        panchanga.nakshatra
                            ? nakshatraFromEnglish(panchanga.nakshatra.name, lang)
                            : '—'
                    }
                    hint={
                        panchanga.nakshatra
                            ? t('panchanga.pada', { pada: panchanga.nakshatra.pada })
                            : undefined
                    }
                />
                <StatCard
                    label={t('panchanga.yoga')}
                    value={panchanga.yoga ? panchangaYogaName(panchanga.yoga, lang) : '—'}
                />
                <StatCard
                    label={t('panchanga.karana')}
                    value={karanaName(panchanga.karana?.name, lang)}
                />
                <StatCard
                    label={t('panchanga.vara')}
                    value={panchanga.vara ? varaName(panchanga.vara, lang) : '—'}
                />
            </div>
            {sunRiseSet && (
                <div className="card" style={{ marginTop: '1rem' }}>
                    <h3>{t('panchanga.riseSet')}</h3>
                    <div className="stat-grid">
                        <StatCard
                            label={t('panchanga.sunrise')}
                            value={riseSetText(sunRiseSet.rise, t)}
                        />
                        <StatCard
                            label={t('panchanga.sunset')}
                            value={riseSetText(sunRiseSet.set, t)}
                        />
                    </div>
                    {riseSetNote ? <p className="panel-footnote">{riseSetNote}</p> : null}
                </div>
            )}
        </div>
    );
}
