import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { DateTime } from 'luxon';
import { planetShortName } from '../chart/geometry';
import { DataTable, type DataColumn } from '../ui/DataTable';
import { useI18n, type Lang } from '../../i18n';
import {
    dashaLevelName,
    dashaLordName,
    dashaSystemName,
    karakaName,
    planetName,
} from '../../i18n/astro';
import {
    DASHA_DURATIONS,
    expandVimshottariLevel,
    mahaPeriod,
    type VimPeriod,
} from '../../lib/vimshottari-expand';

type DashaPeriod = {
    planet: string;
    level?: number;
    start: string;
    end: string;
    durationYears?: number;
    subPeriods?: DashaPeriod[];
};

type Props = {
    vimshottari: DashaPeriod[];
    others: Record<string, DashaPeriod[] | unknown>;
    depth: number;
    karakas: unknown;
    timeZone?: string;
};

type Mode = 'tree' | 'drill';

const MODE_KEY = 'njh-dasha-mode';

const KARAKA_ORDER = ['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK'];
const PLANET_BY_ID: Record<number, string> = {
    0: 'Sun',
    1: 'Moon',
    2: 'Mercury',
    3: 'Venus',
    4: 'Mars',
    5: 'Jupiter',
    6: 'Saturn',
    7: 'Rahu',
    8: 'Ketu',
    10: 'Rahu',
    99: 'Ketu',
};

type KarakaRow = { key: string; planet: string };

/**
 * The worker returns `[{ planetId, karaka, longitude }]`; older snapshots used
 * a `{ AK: 'Sun', ... }` map. Accept both (the array used to print
 * "[object Object]").
 */
export function karakaRows(karakas: unknown): KarakaRow[] {
    let rows: KarakaRow[] = [];
    if (Array.isArray(karakas)) {
        rows = karakas.flatMap((item) => {
            if (!item || typeof item !== 'object') return [];
            const { planetId, karaka } = item as { planetId?: unknown; karaka?: unknown };
            if (typeof karaka !== 'string') return [];
            const planet =
                typeof planetId === 'number'
                    ? (PLANET_BY_ID[planetId] ?? String(planetId))
                    : String(planetId ?? '—');
            return [{ key: karaka, planet }];
        });
    } else if (karakas && typeof karakas === 'object') {
        rows = Object.entries(karakas as Record<string, unknown>).map(([key, planet]) => ({
            key,
            planet:
                typeof planet === 'number'
                    ? (PLANET_BY_ID[planet] ?? String(planet))
                    : String(planet),
        }));
    }
    const rank = (key: string) => {
        const i = KARAKA_ORDER.indexOf(key);
        return i < 0 ? KARAKA_ORDER.length : i;
    };
    return rows.sort((a, b) => rank(a.key) - rank(b.key));
}

function lordLabel(planet: string, lang: Lang): string {
    return lang === 'en' ? planetShortName(planet) : planetName(planet, lang);
}

function loadMode(): Mode {
    if (typeof localStorage === 'undefined') return 'tree';
    return localStorage.getItem(MODE_KEY) === 'drill' ? 'drill' : 'tree';
}

function periodId(period: VimPeriod): string {
    return `${period.level}:${period.planet}:${period.start}`;
}

function formatWhen(iso: string, zone: string): string {
    const dt = DateTime.fromISO(iso, { setZone: true });
    if (!dt.isValid) return iso;
    const local = zone ? dt.setZone(zone) : dt;
    return local.toFormat('yyyy-LL-dd HH:mm');
}

function containsNow(period: VimPeriod, now: number): boolean {
    const start = Date.parse(period.start);
    const end = Date.parse(period.end);
    return Number.isFinite(start) && Number.isFinite(end) && now >= start && now < end;
}

function toVim(period: DashaPeriod, level = 1): VimPeriod {
    return mahaPeriod({
        planet: period.planet,
        level: period.level ?? level,
        start: String(period.start),
        end: String(period.end),
        durationYears: period.durationYears ?? DASHA_DURATIONS[period.planet],
    });
}

export function DashasPanel({ vimshottari, others, depth, karakas, timeZone = 'UTC' }: Props) {
    const [mode, setMode] = useState<Mode>(loadMode);
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
    const [children, setChildren] = useState<Map<string, VimPeriod[]>>(() => new Map());
    const [path, setPath] = useState<VimPeriod[]>([]);
    const [focusId, setFocusId] = useState<string | null>(null);
    const now = Date.now();
    const { lang, t } = useI18n();

    const roots = useMemo(
        () => (Array.isArray(vimshottari) ? vimshottari.map((period) => toVim(period, 1)) : []),
        [vimshottari],
    );

    useEffect(() => {
        localStorage.setItem(MODE_KEY, mode);
    }, [mode]);

    function kidsOf(period: VimPeriod): VimPeriod[] {
        const id = periodId(period);
        const cached = children.get(id);
        if (cached) return cached;
        if (period.level >= 5) return [];
        const next = expandVimshottariLevel(period);
        setChildren((prev) => {
            const copy = new Map(prev);
            copy.set(id, next);
            return copy;
        });
        return next;
    }

    function toggle(period: VimPeriod) {
        const id = periodId(period);
        const opening = !expanded.has(id);
        if (opening && period.level < 5 && !children.has(id)) kidsOf(period);
        setExpanded((prev) => {
            const copy = new Set(prev);
            if (copy.has(id)) copy.delete(id);
            else copy.add(id);
            return copy;
        });
    }

    const drillList = useMemo(() => {
        if (path.length === 0) return roots;
        const parent = path[path.length - 1]!;
        return children.get(periodId(parent)) ?? expandVimshottariLevel(parent);
    }, [path, roots, children]);

    function openDrill(period: VimPeriod) {
        if (period.level >= 5) return;
        const next = children.get(periodId(period)) ?? expandVimshottariLevel(period);
        setChildren((prev) => {
            const copy = new Map(prev);
            copy.set(periodId(period), next);
            return copy;
        });
        setPath((prev) => [...prev, period]);
    }

    function visibleRows(): VimPeriod[] {
        const rows: VimPeriod[] = [];
        const walk = (list: VimPeriod[]) => {
            for (const period of list) {
                rows.push(period);
                if (expanded.has(periodId(period))) walk(kidsOf(period));
            }
        };
        walk(roots);
        return rows;
    }

    function onTreeKey(event: KeyboardEvent<HTMLDivElement>, period: VimPeriod) {
        const rows = visibleRows();
        const index = rows.findIndex((row) => periodId(row) === periodId(period));
        if (event.key === 'ArrowDown' && index >= 0 && index < rows.length - 1) {
            event.preventDefault();
            setFocusId(periodId(rows[index + 1]!));
        } else if (event.key === 'ArrowUp' && index > 0) {
            event.preventDefault();
            setFocusId(periodId(rows[index - 1]!));
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            if (!expanded.has(periodId(period)) && period.level < 5) toggle(period);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (expanded.has(periodId(period))) toggle(period);
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (period.level < 5) toggle(period);
        }
    }

    useEffect(() => {
        if (!focusId) return;
        const node = document.getElementById(`dasha-${focusId}`);
        node?.focus();
    }, [focusId]);

    function renderTree(list: VimPeriod[], level: number) {
        return list.map((period) => {
            const id = periodId(period);
            const open = expanded.has(id);
            const active = containsNow(period, now);
            const childList = open ? (children.get(id) ?? []) : [];
            return (
                <div
                    key={id}
                    role="treeitem"
                    aria-expanded={period.level < 5 ? open : undefined}
                    aria-level={level}
                    aria-current={active ? 'true' : undefined}
                >
                    <div
                        id={`dasha-${id}`}
                        role="button"
                        tabIndex={
                            focusId === id ||
                            (focusId === null && level === 1 && period === list[0])
                                ? 0
                                : -1
                        }
                        className={`dasha-row${active ? ' dasha-row--current' : ''}`}
                        style={{ paddingLeft: `${(level - 1) * 0.9}rem` }}
                        onClick={() => period.level < 5 && toggle(period)}
                        onKeyDown={(event) => onTreeKey(event, period)}
                    >
                        <span className="dasha-row__twist" aria-hidden="true">
                            {period.level >= 5 ? '·' : open ? '▾' : '▸'}
                        </span>
                        <span className="dasha-row__lord">
                            {lordLabel(period.planet, lang)}{' '}
                            <span className="dasha-row__level">
                                {dashaLevelName(period.level, lang)}
                            </span>
                        </span>
                        <span className="mono dasha-row__when">
                            {formatWhen(period.start, timeZone)} –{' '}
                            {formatWhen(period.end, timeZone)}
                        </span>
                    </div>
                    {open && childList.length > 0 && (
                        <div role="group">{renderTree(childList, level + 1)}</div>
                    )}
                </div>
            );
        });
    }

    const karakaList = useMemo(() => karakaRows(karakas), [karakas]);

    const otherEntries = Object.entries(others).filter(
        ([key, value]) => key !== 'vimshottari' && Array.isArray(value) && value.length,
    );

    const columns: DataColumn<{ level: number; row: DashaPeriod }>[] = [
        {
            key: 'lord',
            header: t('dasha.lord'),
            render: ({ level, row }) => (
                <span style={{ paddingLeft: `${level * 0.75}rem` }}>
                    {dashaLordName(row.planet, lang)}
                </span>
            ),
        },
        {
            key: 'start',
            header: t('dasha.start'),
            className: 'mono',
            render: ({ row }) => formatWhen(String(row.start), timeZone),
        },
        {
            key: 'end',
            header: t('dasha.end'),
            className: 'mono',
            render: ({ row }) => formatWhen(String(row.end), timeZone),
        },
    ];

    return (
        <div className="dashas-panel" data-testid="panel-dashas">
            <div className="card">
                <div className="dasha-toolbar">
                    <h3>{t('dasha.vimshottari')}</h3>
                    <div
                        className="dasha-toolbar__modes"
                        role="radiogroup"
                        aria-label={t('dasha.view')}
                    >
                        <button
                            type="button"
                            role="radio"
                            aria-checked={mode === 'tree'}
                            data-testid="dasha-mode-tree"
                            className={`btn btn-outline${mode === 'tree' ? ' is-active' : ''}`}
                            onClick={() => setMode('tree')}
                        >
                            {t('dasha.tree')}
                        </button>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={mode === 'drill'}
                            data-testid="dasha-mode-drill"
                            className={`btn btn-outline${mode === 'drill' ? ' is-active' : ''}`}
                            onClick={() => setMode('drill')}
                        >
                            {t('dasha.drill')}
                        </button>
                    </div>
                </div>
                <p className="dasha-note">{t('dasha.note', { zone: timeZone, depth })}</p>
                {mode === 'tree' ? (
                    <div role="tree" aria-label={t('dasha.treeAria')} data-testid="dasha-tree">
                        {renderTree(roots, 1)}
                    </div>
                ) : (
                    <div data-testid="dasha-drill">
                        <nav className="dasha-crumbs" aria-label={t('dasha.pathAria')}>
                            <button type="button" onClick={() => setPath([])}>
                                {t('dasha.vimshottari')}
                            </button>
                            {path.map((period, index) => (
                                <span key={periodId(period)}>
                                    <span aria-hidden="true"> &gt; </span>
                                    <button
                                        type="button"
                                        onClick={() => setPath(path.slice(0, index + 1))}
                                    >
                                        {dashaLevelName(period.level, lang)}{' '}
                                        {lordLabel(period.planet, lang)}
                                    </button>
                                </span>
                            ))}
                        </nav>
                        <div role="tree" aria-label={t('dasha.levelAria')}>
                            {drillList.map((period) => {
                                const active = containsNow(period, now);
                                return (
                                    <div
                                        key={periodId(period)}
                                        role="treeitem"
                                        aria-level={period.level}
                                        aria-current={active ? 'true' : undefined}
                                        className={`dasha-row${active ? ' dasha-row--current' : ''}`}
                                    >
                                        <button
                                            type="button"
                                            className="dasha-row__drill"
                                            onClick={() => openDrill(period)}
                                            disabled={period.level >= 5}
                                        >
                                            <span>
                                                {lordLabel(period.planet, lang)}{' '}
                                                <span className="dasha-row__level">
                                                    {dashaLevelName(period.level, lang)}
                                                </span>
                                            </span>
                                            <span className="mono">
                                                {formatWhen(period.start, timeZone)} –{' '}
                                                {formatWhen(period.end, timeZone)}
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            {otherEntries.map(([name, tree]) => (
                <div className="card" key={name}>
                    <h3>{dashaSystemName(name, lang)}</h3>
                    <DataTable
                        columns={columns}
                        rows={flattenDashaTable(tree as DashaPeriod[]).slice(0, 40)}
                        rowKey={(row) => `${name}-${row.row.planet}-${row.row.start}`}
                        compact
                        capped
                    />
                </div>
            ))}
            {karakaList.length > 0 ? (
                <div className="card">
                    <h3>{t('dasha.karakasTitle')}</h3>
                    <DataTable
                        columns={[
                            {
                                key: 'k',
                                header: t('dasha.karaka'),
                                render: (row) => karakaName(row.key, lang),
                            },
                            {
                                key: 'p',
                                header: t('dasha.planet'),
                                render: (row) => planetName(row.planet, lang),
                            },
                        ]}
                        rows={karakaList}
                        rowKey={(row) => row.key}
                        compact
                    />
                </div>
            ) : null}
        </div>
    );
}

function flattenDashaTable(
    periods: DashaPeriod[],
    level = 0,
): { level: number; row: DashaPeriod }[] {
    const out: { level: number; row: DashaPeriod }[] = [];
    for (const period of periods) {
        out.push({ level, row: period });
        if (period.subPeriods?.length) {
            out.push(...flattenDashaTable(period.subPeriods, level + 1));
        }
    }
    return out;
}
