import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PlaceHit } from '@node-jhora/atlas';
import { formatPlaceLabel } from '../lib/place-label';
import type { PlaceSearchResponse } from '../worker/place-worker';
import PlaceWorker from '../worker/place-worker?worker';

const DEBOUNCE_MS = 150;
const MIN_QUERY = 2;

type WorkerHandle = {
    worker: Worker;
    nextId: number;
    pending: Map<number, (response: PlaceSearchResponse) => void>;
};

let shared: WorkerHandle | null = null;

function placeWorker(): WorkerHandle {
    if (!shared) {
        const worker = new PlaceWorker();
        const pending = new Map<number, (response: PlaceSearchResponse) => void>();
        worker.onmessage = (event: MessageEvent<PlaceSearchResponse>) => {
            const resolve = pending.get(event.data.id);
            if (!resolve) return;
            pending.delete(event.data.id);
            resolve(event.data);
        };
        shared = { worker, nextId: 1, pending };
    }
    return shared;
}

function manifestUrl(): string {
    return new URL(`${import.meta.env.BASE_URL}atlas/manifest.json`, window.location.origin).href;
}

function searchPlaces(query: string): Promise<PlaceSearchResponse> {
    const handle = placeWorker();
    const id = handle.nextId++;
    return new Promise((resolve) => {
        handle.pending.set(id, resolve);
        handle.worker.postMessage({ id, manifestUrl: manifestUrl(), query });
    });
}

type Props = {
    initialLabel?: string;
    onPick: (hit: PlaceHit) => void;
};

export function PlaceCombobox({ initialLabel = '', onPick }: Props) {
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const fieldRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState(initialLabel);
    const [dropUp, setDropUp] = useState(false);
    const [hits, setHits] = useState<PlaceHit[]>([]);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const picked = useRef(initialLabel.length > 0);
    const request = useRef(0);

    useEffect(() => {
        if (picked.current || query.trim().length < MIN_QUERY) {
            setHits([]);
            setBusy(false);
            setError(undefined);
            if (!picked.current) setOpen(false);
            return;
        }
        const token = ++request.current;
        setBusy(true);
        setOpen(true);
        const timer = window.setTimeout(() => {
            void searchPlaces(query).then((response) => {
                if (token !== request.current) return;
                setBusy(false);
                setError(response.error);
                setHits(response.hits);
                setActive(0);
                setOpen(true);
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
        onPick(hit);
        inputRef.current?.focus();
    }

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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

    const showList = open && query.trim().length >= MIN_QUERY;

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

    return (
        <div className="place-combo">
            <label htmlFor="place">Birth place</label>
            <div className="place-combo__field" ref={fieldRef}>
                <input
                    id="place"
                    ref={inputRef}
                    className="place-combo__input"
                    role="combobox"
                    data-testid="place-input"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="e.g. Chennai"
                    aria-autocomplete="list"
                    aria-expanded={showList}
                    aria-controls={listId}
                    aria-activedescendant={activeId}
                    value={query}
                    onChange={(event) => {
                        picked.current = false;
                        setQuery(event.target.value);
                    }}
                    onFocus={() => {
                        // Open the worker once. The manifest is fetched here; each query
                        // then fetches only its 2-letter shard.
                        void searchPlaces('');
                        if (!picked.current && query.trim().length >= MIN_QUERY) setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                />
                {showList && (
                    <ul
                        id={listId}
                        role="listbox"
                        className={`place-combo__list${dropUp ? ' place-combo__list--up' : ''}`}
                        data-testid="place-list"
                        aria-label="Matching places"
                    >
                        {busy && hits.length === 0 && (
                            <li className="place-combo__status" role="presentation">
                                Searching…
                            </li>
                        )}
                        {error && (
                            <li className="place-combo__status" role="presentation">
                                Place index unavailable — enter coordinates manually
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
                                No matches — enter coordinates manually
                            </li>
                        )}
                    </ul>
                )}
            </div>
            <p className="place-combo__credit">
                Places ©{' '}
                <a href="https://www.geonames.org/" rel="noreferrer">
                    GeoNames
                </a>
                , CC BY 4.0. Latitude, longitude, and time zone stay editable.
            </p>
        </div>
    );
}
