import { useId, useRef } from 'react';
import { AYANAMSA_IDS, HOUSE_SYSTEM_IDS } from '@node-jhora/core';
import { useI18n, type MessageKey } from '../i18n';
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
    progress?: { phase: string; percent: number; message?: string };
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
    submitLabel,
    loading = false,
    kernelReady = true,
    progress,
}: Props) {
    const nameRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const formId = useId();
    const fid = (name: string) => `${idPrefix}${name}`;
    const { lang, t } = useI18n();
    const phaseKey = `form.phase.${progress?.phase ?? ''}` as MessageKey;
    const phaseLabel = progress && t(phaseKey) !== phaseKey ? t(phaseKey) : progress?.phase;

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
                    {t('form.savedProfile')}
                </label>
                <select
                    id={fid('profile')}
                    value={activeId ?? ''}
                    onChange={(event) => onSelectProfile(event.target.value)}
                    aria-label={t('form.savedProfile')}
                >
                    {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                            {profile.name.trim() || t('common.untitled')}
                        </option>
                    ))}
                    {profiles.length === 0 && <option value="">{t('form.noProfiles')}</option>}
                </select>
                <button type="button" className="btn btn-outline" onClick={onAdd}>
                    {t('form.add')}
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
                    {t('form.rename')}
                </button>
                <button type="button" className="btn btn-outline" onClick={onDuplicate}>
                    {t('form.duplicate')}
                </button>
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={onDelete}
                    disabled={profiles.length === 0}
                >
                    {t('form.delete')}
                </button>
            </div>

            <div className="field-row">
                <label htmlFor={fid('name')}>{t('form.name')}</label>
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
                    <label htmlFor={fid('date')}>{t('form.date')}</label>
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
                    <label htmlFor={fid('time')}>{t('form.time')}</label>
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
                <summary>{t('form.advanced')}</summary>
                <div className="field-row">
                    <label htmlFor={fid('lat')}>{t('form.latitude')}</label>
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
                    <label htmlFor={fid('lon')}>{t('form.longitude')}</label>
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
                    <label htmlFor={fid('tz')}>{t('form.timezone')}</label>
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
                    <label htmlFor={fid('ayan')}>{t('form.ayanamsa')}</label>
                    <select
                        id={fid('ayan')}
                        value={draft.ayanamsa}
                        onChange={(event) =>
                            onChange({ ayanamsa: event.target.value as BirthDraft['ayanamsa'] })
                        }
                    >
                        {AYANAMSA_IDS.map((id) => (
                            <option key={id} value={id}>
                                {labelAyanamsa(id, lang)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field-row">
                    <label htmlFor={fid('hs')}>{t('form.houseSystem')}</label>
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
                                {labelHouseSystem(id, lang)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field-row">
                    <label htmlFor={fid('node')}>{t('form.nodeType')}</label>
                    <select
                        id={fid('node')}
                        value={draft.nodeType}
                        onChange={(event) =>
                            onChange({ nodeType: event.target.value === 'mean' ? 'mean' : 'true' })
                        }
                    >
                        <option value="true">{t('form.nodeTrue')}</option>
                        <option value="mean">{t('form.nodeMean')}</option>
                    </select>
                </div>
                <div className="field-row">
                    <label htmlFor={fid('cv')}>{t('form.customVarga')}</label>
                    <input
                        id={fid('cv')}
                        value={draft.customVarga}
                        placeholder={t('form.customVargaPlaceholder')}
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
                    {t('form.importJson')}
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    aria-label={t('form.importJsonAria', { id: formId })}
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

            {progress && !kernelReady && (progress.phase === 'downloading' || progress.message) && (
                <div className="birth-form__kernel">
                    <p className="mono">{t('form.ephemeris', { phase: phaseLabel ?? '' })}</p>
                    <div className="progress" aria-label={t('form.downloadProgress')}>
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
                        disabled={loading}
                    >
                        {loading ? t('form.calculating') : (submitLabel ?? t('form.calculate'))}
                    </button>
                    <p className="birth-form__summary-inline">
                        {birthSummary(draft, t('app.chartFallback'))}
                    </p>
                </div>
            )}
        </form>
    );
}
