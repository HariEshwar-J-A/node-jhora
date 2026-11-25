import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n';
import { CONTACT_URL } from '../lib/constants';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

function navBtnClass({ isActive }: { isActive: boolean }) {
    return `btn btn-nav${isActive ? ' btn-nav-active' : ''}`;
}

export function SiteHeader() {
    const { t } = useI18n();
    return (
        <header className="site-header">
            <NavLink className="wordmark btn btn-ghost" to="/">
                node-jhora
            </NavLink>
            <nav className="nav-pills" aria-label={t('nav.primary')}>
                <NavLink to="/" end className={navBtnClass}>
                    {t('nav.home')}
                </NavLink>
                <NavLink to="/app" className={navBtnClass}>
                    {t('nav.app')}
                </NavLink>
                <NavLink to="/docs" className={navBtnClass}>
                    {t('nav.docs')}
                </NavLink>
            </nav>
            <div className="header-actions">
                <LanguageSwitcher />
                <ThemeToggle />
                <a className="btn btn-default" href={CONTACT_URL}>
                    {t('nav.contact')}
                </a>
            </div>
        </header>
    );
}
