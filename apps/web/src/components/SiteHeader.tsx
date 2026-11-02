import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../lib/theme';

export function SiteHeader() {
    const { mode, setMode } = useTheme();
    return (
        <header className="site-header">
            <Link className="wordmark" to="/">
                node-jhora
            </Link>
            <nav className="nav-links">
                <NavLink to="/" end>
                    Home
                </NavLink>
                <NavLink to="/app">App</NavLink>
                <button
                    type="button"
                    className="btn"
                    onClick={() => setMode(mode === 'aurora' ? 'daylight' : 'aurora')}
                    aria-label="Toggle color theme"
                >
                    {mode === 'aurora' ? 'Daylight' : 'Aurora'}
                </button>
                <a className="btn btn-primary" href="https://harieshwar.dev/#contact">
                    Contact
                </a>
            </nav>
        </header>
    );
}
