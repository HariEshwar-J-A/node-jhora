import { useId } from 'react';
import { LANG_META, LANGS, useI18n, type Lang } from '../i18n';

/** Compact native <select>: keyboard and screen-reader friendly on every device. */
export function LanguageSwitcher() {
    const { lang, setLang, t } = useI18n();
    const id = useId();
    return (
        <div className="lang-switch">
            <label className="sr-only" htmlFor={id}>
                {t('lang.label')}
            </label>
            <svg className="lang-switch__icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path
                    d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                />
            </svg>
            <select
                id={id}
                className="lang-switch__select"
                data-testid="lang-switch"
                value={lang}
                title={t('lang.label')}
                onChange={(event) => setLang(event.target.value as Lang)}
            >
                {LANGS.map((code) => (
                    <option key={code} value={code} lang={code}>
                        {LANG_META[code].native}
                    </option>
                ))}
            </select>
        </div>
    );
}
