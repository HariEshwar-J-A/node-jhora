import { useId, useRef } from 'react';
import { AYANAMSA_IDS, HOUSE_SYSTEM_IDS } from '@node-jhora/core';
import { labelAyanamsa, labelHouseSystem } from '../lib/chart-labels';
import {
    birthSummary,
    draftFromUnknown,
    type BirthDraft,
    type BirthFieldErrors,
    type BirthProfile,
} from '../lib/birth';
import { PlaceCombobox } from './PlaceCombobox';
import { formatCoord, formatPlaceLabel } from '../lib/place-label';

type Props = {
    draft: BirthDraft;
    onChange: (patch: Partial<BirthDraft>) => void;
    profiles: BirthProfile[];
    activeId: string | null;
    onSelectProfile: (id: string) => void;
    onAdd: () => void;
    onRename: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    errors: BirthFieldErrors;
    idPrefix?: string;
    placeTestId?: string;
    showSubmit?: boolean;
    onSubmit?: () => void;
    submitLabel?: string;
    loading?: boolean;
    kernelReady?: boolean;
    progress?: { phase: string; percent: number };
};

function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) return null;
    return (
        <p id={id} className="field-error" role="alert">
            {message}
        </p>
    );
}

export function BirthDataForm({
    draft,
    onChange,
    profiles,
    activeId,
    onSelectProfile,
    onAdd,
    onRename,
    onDuplicate,
    onDelete,
    errors,
    idPrefix = '',
    placeTestId = 'place-input',
    showSubmit = false,
    onSubmit,
    submitLabel = 'Calculate',
    loading = false,
    kernelReady = true,
    progress,
}: Props) {
    const nameRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const formId = useId();
    const fid = (name: string) => `${idPrefix}${name}`;

    return (
        <form
            className="birth-form"
            data-testid={idPrefix ? `birth-form-${idPrefix.replace(/-$/, '')}` : 'birth-form'}
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit?.();
            }}
        >
            <div className="birth-form__tools">
                <label className="sr-only" htmlFor={fid('profile')}>
                    Saved profile
                </label>
                <select
                    id={fid('profile')}
                    value={activeId ?? ''}
                    onChange={(event) => onSelectProfile(event.target.value)}
                    aria-label="Saved profile"
                >
                    {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                            {profile.name.trim() || 'Untitled'}
                        </option>
                    ))}
                    {profiles.length === 0 && <option value="">No saved profiles</option>}
                </select>
                <button type="button" className="btn btn-outline" onClick={onAdd}>
                    Add
                </button>
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                        onRename();
                        nameRef.current?.focus();
                        nameRef.current?.select();
                    }}
                >
                    Rename
                </button>
                <button type="button" className="btn btn-outline" onClick={onDuplicate}>
                    Duplicate
                </button>
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={onDelete}
                    disabled={profiles.length === 0}
                >
                    Delete
                </button>
            </div>

            <div className="field-row">
                <label htmlFor={fid('name')}>Name</label>
                <input
                    id={fid('name')}
                    ref={nameRef}
                    value={draft.name}
                    autoComplete="name"
                    onChange={(event) => onChange({ name: event.target.value })}
                />
            </div>

            <PlaceCombobox
                key={`${idPrefix}${activeId ?? 'draft'}`}
                inputId={fid('place')}
                testId={placeTestId}
                initialLabel={draft.place}
                onPick={(hit) =>
                    onChange({
                        place: formatPlaceLabel(hit),
                        latitude: formatCoord(hit.latitude),
                        longitude: formatCoord(hit.longitude),
                        timezone: hit.timezone,
                    })
                }
            />

            <div className="birth-form__when">
                <div className="field-row">
                    <label htmlFor={fid('date')}>Date</label>
                    <input
                        id={fid('date')}
                        type="date"
                        value={draft.date}
                        aria-invalid={errors.date ? true : undefined}
                        aria-describedby={errors.date ? fid('date-error') : undefined}
                        onChange={(event) => onChange({ date: event.target.value })}
                    />
                    <FieldError id={fid('date-error')} message={errors.date} />
                </div>
                <div className="field-row">
                    <label htmlFor={fid('time')}>Time</label>
                    <input
                        id={fid('time')}
                        type="time"
                        step={60}
                        value={draft.time}
                        aria-invalid={errors.time ? true : undefined}
                        aria-describedby={errors.time ? fid('time-error') : undefined}
                        onChange={(event) => onChange({ time: event.target.value })}
                    />
                    <FieldError id={fid('time-error')} message={errors.time} />
                </div>
            </div>

            <details className="birth-form__advanced">
                <summary>Advanced</summary>
                <div className="field-row">
                    <label htmlFor={fid('lat')}>Latitude</label>
                    <input
                        id={fid('lat')}
                        inputMode="decimal"
                        value={draft.latitude}
                        aria-invalid={errors.latitude ? true : undefined}
                        aria-describedby={errors.latitude ? fid('lat-error') : undefined}
                        onChange={(event) => onChange({ latitude: event.target.value })}
                    />
                    <FieldError id={fid('lat-error')} message={errors.latitude} />
                </div>
                <div className="field-row">
                    <label htmlFor={fid('lon')}>Longitude</label>
                    <input
                        id={fid('lon')}
                        inputMode="decimal"
                        value={draft.longitude}
                        aria-invalid={errors.longitude ? true : undefined}
                        aria-describedby={errors.longitude ? fid('lon-error') : undefined}
                        onChange={(event) => onChange({ longitude: event.target.value })}
                    />
                    <FieldError id={fid('lon-error')} message={errors.longitude} />
                </div>
                <div className="field-row">
                    <label htmlFor={fid('tz')}>Time zone</label>
                    <input
                        id={fid('tz')}
                        value={draft.timezone}
                        aria-invalid={errors.timezone ? true : undefined}
                        aria-describedby={errors.timezone ? fid('tz-error') : undefined}
                        onChange={(event) => onChange({ timezone: event.target.value })}
                    />
                    <FieldError id={fid('tz-error')} message={errors.timezone} />
                </div>
                <div className="field-row">
                    <label htmlFor={fid('ayan')}>Ayanamsa</label>
                    <select
                        id={fid('ayan')}
                        value={draft.ayanamsa}
                        onChange={(event) =>
                            onChange({ ayanamsa: event.target.value as BirthDraft['ayanamsa'] })
                        }
                    >
                        {AYANAMSA_IDS.map((id) => (
                            <option key={id} value={id}>
                                {labelAyanamsa(id)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field-row">
                    <label htmlFor={fid('hs')}>House system</label>
                    <select
                        id={fid('hs')}
                        value={draft.houseSystem}
                        onChange={(event) =>
                            onChange({
                                houseSystem: event.target.value as BirthDraft['houseSystem'],
                            })
                        }
                    >
                        {HOUSE_SYSTEM_IDS.map((id) => (
                            <option key={id} value={id}>
                                {labelHouseSystem(id)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field-row">
                    <label htmlFor={fid('node')}>Node type</label>
                    <select
                        id={fid('node')}
                        value={draft.nodeType}
                        onChange={(event) =>
                            onChange({ nodeType: event.target.value === 'mean' ? 'mean' : 'true' })
                        }
                    >
                        <option value="true">True (osculating)</option>
                        <option value="mean">Mean</option>
                    </select>
                </div>
                <div className="field-row">
                    <label htmlFor={fid('cv')}>Custom varga divisor</label>
                    <input
                        id={fid('cv')}
                        value={draft.customVarga}
                        placeholder="Optional, e.g. 300"
                        aria-invalid={errors.customVarga ? true : undefined}
                        onChange={(event) => onChange({ customVarga: event.target.value })}
                    />
                    <FieldError id={fid('cv-error')} message={errors.customVarga} />
                </div>
            </details>

            <div className="birth-form__io">
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => fileRef.current?.click()}
                >
                    Import JSON
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    aria-label={`Import birth JSON ${formId}`}
                    onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        try {
                            const parsed = draftFromUnknown(JSON.parse(await file.text()));
                            if (!parsed) return;
                            onChange(parsed);
                        } catch {
                            onChange({});
                        }
                    }}
                />
            </div>

            {progress && !kernelReady && (
                <div className="birth-form__kernel">
                    <p className="mono">Ephemeris: {progress.phase}</p>
                    <div className="progress" aria-label="Download progress">
                        <span style={{ width: `${progress.percent}%` }} />
                    </div>
                </div>
            )}

            {showSubmit && (
                <div className="birth-form__submit">
                    <button
                        type="submit"
                        className="btn btn-default"
                        data-testid="calculate-btn"
                        disabled={loading || !kernelReady}
                    >
                        {loading
                            ? 'Calculating…'
                            : kernelReady
                              ? submitLabel
                              : 'Loading ephemeris…'}
                    </button>
                    <p className="birth-form__summary-inline">{birthSummary(draft)}</p>
                </div>
            )}
        </form>
    );
}
