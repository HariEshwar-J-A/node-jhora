import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { DateTime } from 'luxon';
import { planetShortName } from '../chart/geometry';
import { DataTable, type DataColumn } from '../ui/DataTable';
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
const LEVEL_NAME = ['', 'Maha', 'Antar', 'Pratyantar', 'Sookshma', 'Prana'];

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
                            {planetShortName(period.planet)}{' '}
                            <span className="dasha-row__level">{LEVEL_NAME[period.level]}</span>
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

    const otherEntries = Object.entries(others).filter(
        ([key, value]) => key !== 'vimshottari' && Array.isArray(value) && value.length,
    );

    const columns: DataColumn<{ level: number; row: DashaPeriod }>[] = [
        {
            key: 'lord',
            header: 'Lord',
            render: ({ level, row }) => (
                <span style={{ paddingLeft: `${level * 0.75}rem` }}>{row.planet}</span>
            ),
        },
        {
            key: 'start',
            header: 'Start',
            className: 'mono',
            render: ({ row }) => formatWhen(String(row.start), timeZone),
        },
        {
            key: 'end',
            header: 'End',
            className: 'mono',
            render: ({ row }) => formatWhen(String(row.end), timeZone),
        },
    ];

    return (
        <div className="dashas-panel" data-testid="panel-dashas">
            <div className="card">
                <div className="dasha-toolbar">
                    <h3>Vimshottari</h3>
                    <div className="dasha-toolbar__modes" role="radiogroup" aria-label="Dasha view">
                        <button
                            type="button"
                            role="radio"
                            aria-checked={mode === 'tree'}
                            data-testid="dasha-mode-tree"
                            className={`btn btn-outline${mode === 'tree' ? ' is-active' : ''}`}
                            onClick={() => setMode('tree')}
                        >
                            Tree
                        </button>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={mode === 'drill'}
                            data-testid="dasha-mode-drill"
                            className={`btn btn-outline${mode === 'drill' ? ' is-active' : ''}`}
                            onClick={() => setMode('drill')}
                        >
                            Drill-down
                        </button>
                    </div>
                </div>
                <p className="dasha-note">
                    Dates in {timeZone}. The running period is highlighted. Levels below the
                    mahadasha (depth {depth} on the chart) load when you open a row.
                </p>
                {mode === 'tree' ? (
                    <div role="tree" aria-label="Vimshottari dasha" data-testid="dasha-tree">
                        {renderTree(roots, 1)}
                    </div>
                ) : (
                    <div data-testid="dasha-drill">
                        <nav className="dasha-crumbs" aria-label="Dasha path">
                            <button type="button" onClick={() => setPath([])}>
                                Vimshottari
                            </button>
                            {path.map((period, index) => (
                                <span key={periodId(period)}>
                                    <span aria-hidden="true"> &gt; </span>
                                    <button
                                        type="button"
                                        onClick={() => setPath(path.slice(0, index + 1))}
                                    >
                                        {planetShortName(period.planet)}
                                    </button>
                                </span>
                            ))}
                        </nav>
                        <div role="tree" aria-label="Vimshottari level">
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
                                                {planetShortName(period.planet)}{' '}
                                                <span className="dasha-row__level">
                                                    {LEVEL_NAME[period.level]}
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
                    <h3>{name.replace(/([A-Z])/g, ' $1').trim()}</h3>
                    <DataTable
                        columns={columns}
                        rows={flattenDashaTable(tree as DashaPeriod[]).slice(0, 40)}
                        rowKey={(row) => `${name}-${row.row.planet}-${row.row.start}`}
                        compact
                    />
                </div>
            ))}
            {karakas && typeof karakas === 'object' ? (
                <div className="card">
                    <h3>Jaimini chara karakas</h3>
                    <DataTable
                        columns={[
                            { key: 'k', header: 'Karaka', render: (row) => row.key },
                            { key: 'p', header: 'Planet', render: (row) => row.planet },
                        ]}
                        rows={Object.entries(karakas as Record<string, string>).map(
                            ([key, planet]) => ({
                                key,
                                planet: String(planet),
                            }),
                        )}
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
