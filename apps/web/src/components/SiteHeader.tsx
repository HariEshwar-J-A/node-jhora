import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { CONTACT_URL } from '../lib/constants';
import { MQ_NAV_COMPACT, useMediaQuery } from '../hooks/useMediaQuery';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { Drawer } from './ui/Drawer';

function navBtnClass({ isActive }: { isActive: boolean }) {
    return `btn btn-nav${isActive ? ' btn-nav-active' : ''}`;
}

function menuLinkClass({ isActive }: { isActive: boolean }) {
    return `menu-link${isActive ? ' menu-link--active' : ''}`;
}

function MenuIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function SiteHeader() {
    const { t } = useI18n();
    const compact = useMediaQuery(MQ_NAV_COMPACT);
    const [menuOpen, setMenuOpen] = useState(false);
    const { pathname } = useLocation();

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);
    useEffect(() => {
        if (!compact) setMenuOpen(false);
    }, [compact]);

    return (
        <header className="site-header">
            <NavLink className="wordmark btn btn-ghost" to="/">
                node-jhora
            </NavLink>
            {compact ? (
                <div className="header-actions">
                    <button
                        type="button"
                        className="icon-btn"
                        data-testid="menu-btn"
                        aria-label={t('nav.openMenu')}
                        aria-haspopup="dialog"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen(true)}
                    >
                        <MenuIcon />
                    </button>
                    <Drawer
                        open={menuOpen}
                        onClose={() => setMenuOpen(false)}
                        side="right"
                        title={t('nav.menu')}
                        closeLabel={t('nav.closeMenu')}
                        className="menu-drawer"
                    >
                        <nav className="menu-nav" aria-label={t('nav.primary')}>
                            <NavLink to="/" end className={menuLinkClass}>
                                {t('nav.home')}
                            </NavLink>
                            <NavLink to="/app" className={menuLinkClass}>
                                {t('nav.app')}
                            </NavLink>
                            <NavLink to="/docs" className={menuLinkClass}>
                                {t('nav.docs')}
                            </NavLink>
                        </nav>
                        <div className="menu-section">
                            <p className="menu-section__label">{t('lang.label')}</p>
                            <LanguageSwitcher />
                        </div>
                        <div className="menu-section menu-section--tight">
                            <p className="menu-section__label">{t('theme.label')}</p>
                            <ThemeToggle block />
                        </div>
                        <a className="btn btn-default menu-cta" href={CONTACT_URL}>
                            {t('nav.contact')}
                        </a>
                    </Drawer>
                </div>
            ) : (
                <>
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
                </>
            )}
        </header>
    );
}
