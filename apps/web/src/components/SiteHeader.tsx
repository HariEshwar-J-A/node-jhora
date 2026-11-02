import { NavLink } from 'react-router-dom';
import { CONTACT_URL } from '../lib/constants';
import { ThemeToggle } from './ThemeToggle';

function navBtnClass({ isActive }: { isActive: boolean }) {
    return `btn btn-nav${isActive ? ' btn-nav-active' : ''}`;
}

export function SiteHeader() {
    return (
        <header className="site-header">
            <NavLink className="wordmark btn btn-ghost" to="/">
                node-jhora
            </NavLink>
            <nav className="nav-pills" aria-label="Primary">
                <NavLink to="/" end className={navBtnClass}>
                    Home
                </NavLink>
                <NavLink to="/app" className={navBtnClass}>
                    App
                </NavLink>
                <NavLink to="/docs" className={navBtnClass}>
                    Docs
                </NavLink>
            </nav>
            <div className="header-actions">
                <ThemeToggle />
                <a className="btn btn-default" href={CONTACT_URL}>
                    Contact
                </a>
            </div>
        </header>
    );
}
