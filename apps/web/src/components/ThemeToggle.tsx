import { useI18n } from '../i18n';
import { useTheme } from '../lib/theme';

export function ThemeToggle({ block = false }: { block?: boolean }) {
    const { mode, toggle } = useTheme();
    const { t } = useI18n();
    const label = mode === 'dark' ? t('theme.toLight') : t('theme.toDark');
    return (
        <button
            type="button"
            className={block ? 'btn btn-outline menu-theme' : 'icon-btn'}
            aria-label={block ? undefined : label}
            title={block ? undefined : label}
            onClick={toggle}
        >
            {mode === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <circle
                        cx="12"
                        cy="12"
                        r="4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                    />
                    <path
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                    />
                </svg>
            ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 0 0 21 14.5Z"
                    />
                </svg>
            )}
            {block && <span>{label}</span>}
        </button>
    );
}
