import { Link } from 'react-router-dom';
import { AnimatedHeroBackground } from '../components/AnimatedHeroBackground';
import { Reveal } from '../components/Reveal';
import { LandingSkyHero } from '../components/space-intro/LandingSkyHero';
import { CONTACT_EMAIL, CONTACT_URL } from '../lib/constants';

const tiers = [
    { name: 'Free API', note: 'Coming soon', detail: 'Rate-limited HTTP API (not yet available).' },
    {
        name: 'Developer license',
        note: 'Contact for pricing',
        detail: 'Node.js library for individual development.',
    },
    {
        name: 'Commercial license',
        note: 'Contact for pricing',
        detail: 'Paid use in products and services.',
    },
    {
        name: 'Enterprise / API',
        note: 'Contact for pricing',
        detail: 'High-volume API and support arrangements.',
    },
];

const facts = [
    'JPL DE440s ephemeris kernel (32,726,016 bytes), validated by SHA-256 in the browser loader.',
    '24 named divisional charts through D150, plus harmonic fallback for custom divisors.',
    '26 house systems and 9 named ayanamsa presets in the settings schema (modes 0–46 in the engine registry).',
    'Vimshottari dasha recursion to five levels (Maha through Prana) in @node-jhora/prediction.',
];

const features = [
    {
        title: 'DE440s in the browser',
        body: 'Pure TypeScript SPK reader; kernel loads once with progress and SHA-256 verification.',
        icon: (
            <svg className="feature-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="0.8" />
            </svg>
        ),
    },
    {
        title: 'JHora-aligned defaults',
        body: 'True Chitrapaksha, geometric positions, true node, and D-10 (5–8) scheme match Jagannatha Hora conventions.',
        icon: (
            <svg className="feature-icon" viewBox="0 0 24 24" aria-hidden="true">
                <polygon
                    points="12,2 22,12 12,22 2,12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                />
            </svg>
        ),
    },
    {
        title: 'Private by design',
        body: 'Chart demo runs in a Web Worker; birth data stays on your device. Sample chart only on first load.',
        icon: (
            <svg className="feature-icon" viewBox="0 0 24 24" aria-hidden="true">
                <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                />
                <path
                    d="M8 11V8a4 4 0 0 1 8 0v3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                />
            </svg>
        ),
    },
    {
        title: 'Full stack packages',
        body: 'Core, analytics, prediction, match, events, and format—same math in Node and in this app.',
        icon: (
            <svg className="feature-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                    d="M4 7h16M4 12h10M4 17h14"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    fill="none"
                />
            </svg>
        ),
    },
];

export function LandingPage() {
    return (
        <>
            <div className="hero-wrap hero-wrap--cinema">
                <LandingSkyHero>
                    <section className="hero">
                        <span className="badge mono">PROPRIETARY · CLOSED SOURCE</span>
                        <h1>Vedic chart engine for Node.js and the browser</h1>
                        <p>
                            node-jhora computes sidereal charts with a pure TypeScript JPL DE440s
                            reader—no Swiss Ephemeris, no WASM. Licensing lives here; the chart app
                            runs entirely in your browser.
                        </p>
                        <div className="hero-actions">
                            <Link className="btn btn-default" to="/app">
                                Open chart app
                            </Link>
                            <Link className="btn btn-outline" to="/docs">
                                Read docs
                            </Link>
                            <a className="btn btn-ghost" href={CONTACT_URL}>
                                Contact for licensing
                            </a>
                        </div>
                    </section>
                </LandingSkyHero>
            </div>

            <Reveal>
                <section className="section">
                    <h2>Verified capabilities</h2>
                    <ul>
                        {facts.map((f) => (
                            <li key={f}>{f}</li>
                        ))}
                    </ul>
                </section>
            </Reveal>

            <div className="section-motif">
                <AnimatedHeroBackground />
                <section className="section section-motif__inner">
                    <h2>Why node-jhora</h2>
                    <div className="feature-grid">
                        {features.map((f, i) => (
                            <Reveal key={f.title} delay={i * 0.06}>
                                <article className="card card-hover feature-card">
                                    {f.icon}
                                    <h3>{f.title}</h3>
                                    <p>{f.body}</p>
                                </article>
                            </Reveal>
                        ))}
                    </div>
                </section>
            </div>

            <Reveal>
                <section className="section" id="licensing">
                    <h2>Licensing</h2>
                    <p>
                        The library is closed source and proprietary. All rights reserved.
                        Commercial use requires a paid license. Questions:{' '}
                        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or{' '}
                        <a href={CONTACT_URL}>the portfolio contact form</a>.
                    </p>
                    <div className="pricing-grid">
                        {tiers.map((t) => (
                            <article className="card" key={t.name}>
                                <h3>{t.name}</h3>
                                <p className="mono">{t.note}</p>
                                <p
                                    style={{
                                        color: 'hsl(var(--muted-foreground))',
                                        fontSize: '0.875rem',
                                    }}
                                >
                                    {t.detail}
                                </p>
                                <a
                                    className="btn btn-outline"
                                    href={CONTACT_URL}
                                    style={{ marginTop: '0.75rem' }}
                                >
                                    Contact for pricing
                                </a>
                            </article>
                        ))}
                    </div>
                </section>
            </Reveal>

            <footer className="footer">
                <p>
                    © {new Date().getFullYear()} Harieshwar Jagan Abirami. node-jhora is not open
                    source. Ephemeris data: NASA/JPL DE440s (public domain). No analytics on this
                    demo.
                </p>
            </footer>
        </>
    );
}
