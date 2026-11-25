import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PlaceHit } from '@node-jhora/atlas';
import { useI18n } from '../i18n';
import { formatPlaceLabel } from '../lib/place-label';
import { searchPlaces } from '../lib/place-index';

const DEBOUNCE_MS = 150;
const MIN_QUERY = 2;

type Props = {
    initialLabel?: string;
    onPick: (hit: PlaceHit) => void;
    inputId?: string;
    testId?: string;
    label?: string;
};

export function PlaceCombobox({
    initialLabel = '',
    onPick,
    inputId = 'place',
    testId = 'place-input',
    label,
}: Props) {
    const { t, rich } = useI18n();
    const listId = useId();
    const progressId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const fieldRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState(initialLabel);
    const [dropUp, setDropUp] = useState(false);
    const [hits, setHits] = useState<PlaceHit[]>([]);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(false);
    const [percent, setPercent] = useState(0);
    const [error, setError] = useState<string | undefined>();
    const picked = useRef(initialLabel.length > 0);
    const request = useRef(0);

    useEffect(() => {
        if (!loading && percent === 100) inputRef.current?.focus();
    }, [loading, percent]);

    useEffect(() => {
        if (picked.current || query.trim().length < MIN_QUERY) {
            setHits([]);
            setBusy(false);
            setLoading(false);
            setError(undefined);
            if (!picked.current) setOpen(false);
            return;
        }
        const token = ++request.current;
        setBusy(true);
        const timer = window.setTimeout(() => {
            let streamed = false;
            void searchPlaces(query, (next) => {
                if (token !== request.current) return;
                streamed = true;
                setLoading(true);
                setPercent(next);
            }).then((response) => {
                if (token !== request.current) return;
                setBusy(false);
                setError(response.error);
                setHits(response.hits);
                setActive(0);
                setOpen(true);
                if (streamed) setPercent(100);
                setLoading(false);
            });
        }, DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [query]);

    function choose(hit: PlaceHit) {
        picked.current = true;
        request.current += 1;
        setQuery(formatPlaceLabel(hit));
        setHits([]);
        setOpen(false);
        setBusy(false);
        setLoading(false);
        onPick(hit);
        inputRef.current?.focus();
    }

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (loading) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) {
                setOpen(hits.length > 0);
                return;
            }
            setActive((index) => (hits.length === 0 ? 0 : (index + 1) % hits.length));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open || hits.length === 0) return;
            setActive((index) => (index - 1 + hits.length) % hits.length);
            return;
        }
        if (event.key === 'Enter') {
            if (!open) return;
            event.preventDefault();
            const hit = hits[active];
            if (hit) choose(hit);
            return;
        }
        if (event.key === 'Escape') {
            if (!open) return;
            event.preventDefault();
            setOpen(false);
        }
    }

    const showList = open && !loading && query.trim().length >= MIN_QUERY;

    useLayoutEffect(() => {
        if (!showList || !fieldRef.current) return;
        const rect = fieldRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const cap = Math.min(320, window.innerHeight * 0.5);
        setDropUp(spaceBelow < cap && spaceAbove > spaceBelow);
    }, [showList, hits]);
    const activeId = showList && hits[active] ? `${listId}-opt-${active}` : undefined;
    const empty = showList && !busy && !error && hits.length === 0;
    const loadingLabel = t('place.loading', { percent });

    return (
        <div className="place-combo">
            <label htmlFor={inputId}>{label ?? t('place.label')}</label>
            <div className="place-combo__field" ref={fieldRef}>
                <input
                    id={inputId}
                    ref={inputRef}
                    className="place-combo__input"
                    role="combobox"
                    data-testid={testId}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t('place.placeholder')}
                    aria-autocomplete="list"
                    aria-expanded={showList}
                    aria-controls={listId}
                    aria-activedescendant={activeId}
                    aria-busy={loading}
                    aria-describedby={loading ? progressId : undefined}
                    readOnly={loading}
                    value={query}
                    onChange={(event) => {
                        picked.current = false;
                        setQuery(event.target.value);
                    }}
                    onFocus={() => {
                        if (!picked.current && query.trim().length >= MIN_QUERY) setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                />
                {loading && (
                    <>
                        <div
                            className="place-combo__meter"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                            aria-valuetext={loadingLabel}
                            aria-labelledby={progressId}
                            data-testid="place-progress"
                        >
                            <div
                                className="place-combo__meter-fill"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <p
                            id={progressId}
                            className="place-combo__meter-label"
                            data-testid="place-loading"
                        >
                            {loadingLabel}
                        </p>
                    </>
                )}
                {showList && (
                    <ul
                        id={listId}
                        role="listbox"
                        className={`place-combo__list${dropUp ? ' place-combo__list--up' : ''}`}
                        data-testid="place-list"
                        aria-label={t('place.listLabel')}
                    >
                        {busy && hits.length === 0 && (
                            <li className="place-combo__status" role="presentation">
                                {t('place.searching')}
                            </li>
                        )}
                        {error && (
                            <li className="place-combo__status" role="presentation">
                                {t('place.unavailable')}
                            </li>
                        )}
                        {hits.map((hit, index) => {
                            const label = formatPlaceLabel(hit);
                            const selected = index === active;
                            return (
                                <li
                                    key={hit.geonameId}
                                    id={`${listId}-opt-${index}`}
                                    role="option"
                                    aria-selected={selected}
                                    className="place-combo__option"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onMouseEnter={() => setActive(index)}
                                    onClick={() => choose(hit)}
                                >
                                    {label}
                                </li>
                            );
                        })}
                        {empty && (
                            <li
                                className="place-combo__status"
                                role="option"
                                aria-disabled="true"
                                aria-selected="false"
                                data-testid="place-empty"
                            >
                                {t('place.noMatches')}
                            </li>
                        )}
                    </ul>
                )}
            </div>
            <p className="place-combo__credit">
                {rich('place.credit', {
                    geonames: (
                        <a href="https://www.geonames.org/" rel="noreferrer">
                            GeoNames
                        </a>
                    ),
                })}
            </p>
        </div>
    );
}
