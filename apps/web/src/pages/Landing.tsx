import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, CONTACT_URL } from '../lib/constants';

const tiers = [
    { name: 'Free API', note: 'Coming soon', detail: 'Rate-limited HTTP API (not yet available).' },
    { name: 'Developer license', note: 'Contact for pricing', detail: 'Node.js library for individual development.' },
    { name: 'Commercial license', note: 'Contact for pricing', detail: 'Paid use in products and services.' },
    { name: 'Enterprise / API', note: 'Contact for pricing', detail: 'High-volume API and support arrangements.' },
];

const facts = [
    'JPL DE440s ephemeris kernel (32,726,016 bytes), validated by SHA-256 in the browser loader.',
    '24 named divisional charts through D150, plus harmonic fallback for custom divisors.',
    '26 house systems and 9 named ayanamsa presets in the settings schema (modes 0–46 in the engine registry).',
    'Vimshottari dasha recursion to five levels (Maha through Prana) in @node-jhora/prediction.',
];

export function LandingPage() {
    return (
        <>
            <section className="hero">
                <p className="mono">PROPRIETARY · CLOSED SOURCE</p>
                <h1>Vedic chart engine for Node.js and the browser</h1>
                <p>
                    node-jhora computes sidereal charts with a pure TypeScript JPL DE440s reader—no Swiss
                    Ephemeris, no WASM. This site hosts licensing information and a client-side demo; birth
                    data never leaves your browser.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                    <Link className="btn btn-primary" to="/app">
                        Open chart app
                    </Link>
                    <a className="btn" href={CONTACT_URL}>
                        Contact for licensing
                    </a>
                </div>
            </section>

            <section className="section">
                <h2>Verified capabilities</h2>
                <ul>
                    {facts.map((f) => (
                        <li key={f}>{f}</li>
                    ))}
                </ul>
            </section>

            <section className="section">
                <h2>Licensing</h2>
                <p>
                    The library is closed source and proprietary. All rights reserved. Commercial use requires a
                    paid license. Questions:{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or{' '}
                    <a href={CONTACT_URL}>the portfolio contact form</a>.
                </p>
                <div className="pricing-grid">
                    {tiers.map((t) => (
                        <article className="card" key={t.name}>
                            <h3>{t.name}</h3>
                            <p className="mono">{t.note}</p>
                            <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>{t.detail}</p>
                            <a className="btn" href={CONTACT_URL} style={{ marginTop: '0.75rem' }}>
                                Contact for pricing
                            </a>
                        </article>
                    ))}
                </div>
            </section>

            <footer className="footer">
                <p>
                    © {new Date().getFullYear()} Harieshwar Jagan Abirami. node-jhora is not open source.
                    Ephemeris data: NASA/JPL DE440s (public domain). No analytics on this demo.
                </p>
            </footer>
        </>
    );
}
