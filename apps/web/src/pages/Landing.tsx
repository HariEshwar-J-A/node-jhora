import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedHeroBackground } from '../components/AnimatedHeroBackground';
import { Reveal } from '../components/Reveal';
import { LandingSkyHero } from '../components/space-intro/LandingSkyHero';
import { useI18n, type MessageKey } from '../i18n';
import { CONTACT_EMAIL, CONTACT_URL } from '../lib/constants';
import { useTheme } from '../lib/theme';

const tiers = [
    { name: 'landing.tierFree', note: 'landing.tierFreeNote', detail: 'landing.tierFreeDetail' },
    { name: 'landing.tierDev', note: 'landing.contactPricing', detail: 'landing.tierDevDetail' },
    {
        name: 'landing.tierCommercial',
        note: 'landing.contactPricing',
        detail: 'landing.tierCommercialDetail',
    },
    {
        name: 'landing.tierEnterprise',
        note: 'landing.contactPricing',
        detail: 'landing.tierEnterpriseDetail',
    },
] as const satisfies readonly { name: MessageKey; note: MessageKey; detail: MessageKey }[];

const facts = ['landing.fact1', 'landing.fact2', 'landing.fact3', 'landing.fact4'] as const;

const features = [
    {
        title: 'landing.feature1Title',
        body: 'landing.feature1Body',
        icon: (
            <svg className="feature-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="0.8" />
            </svg>
        ),
    },
    {
        title: 'landing.feature2Title',
        body: 'landing.feature2Body',
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
        title: 'landing.feature3Title',
        body: 'landing.feature3Body',
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
        title: 'landing.feature4Title',
        body: 'landing.feature4Body',
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
] as const;

export function LandingPage() {
    const { mode } = useTheme();
    const { t, rich } = useI18n();

    useEffect(() => {
        if (mode !== 'light') {
            document.body.classList.remove('landing-past-hero');
            return;
        }
        const syncPastHero = () => {
            const hero = document.querySelector('.hero-wrap--cinema');
            const header = document.querySelector('.site-header');
            if (!hero || !header) {
                document.body.classList.remove('landing-past-hero');
                return;
            }
            const past =
                hero.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom + 1;
            document.body.classList.toggle('landing-past-hero', past);
        };
        syncPastHero();
        window.addEventListener('scroll', syncPastHero, { passive: true });
        window.addEventListener('resize', syncPastHero, { passive: true });
        return () => {
            window.removeEventListener('scroll', syncPastHero);
            window.removeEventListener('resize', syncPastHero);
            document.body.classList.remove('landing-past-hero');
        };
    }, [mode]);

    return (
        <div className={`landing-page${mode === 'dark' ? ' landing-page--sky' : ''}`}>
            <div className="hero-wrap hero-wrap--cinema">
                <LandingSkyHero>
                    <section className="hero">
                        <span className="badge mono">{t('landing.badge')}</span>
                        <h1>{t('landing.title')}</h1>
                        <p>{t('landing.lead')}</p>
                        <div className="hero-actions">
                            <Link className="btn btn-default" to="/app">
                                {t('landing.openApp')}
                            </Link>
                            <Link className="btn btn-outline" to="/docs">
                                {t('landing.readDocs')}
                            </Link>
                            <a className="btn btn-ghost" href={CONTACT_URL}>
                                {t('landing.contactLicensing')}
                            </a>
                        </div>
                    </section>
                </LandingSkyHero>
            </div>

            <Reveal>
                <section className="section">
                    <h2>{t('landing.factsTitle')}</h2>
                    <ul>
                        {facts.map((f) => (
                            <li key={f}>{t(f)}</li>
                        ))}
                    </ul>
                </section>
            </Reveal>

            <div className="section-motif">
                {mode === 'light' && <AnimatedHeroBackground />}
                <section className="section section-motif__inner">
                    <h2>{t('landing.whyTitle')}</h2>
                    <div className="feature-grid">
                        {features.map((f, i) => (
                            <Reveal key={f.title} delay={i * 0.06}>
                                <article className="card card-hover feature-card">
                                    {f.icon}
                                    <h3>{t(f.title)}</h3>
                                    <p>{t(f.body)}</p>
                                </article>
                            </Reveal>
                        ))}
                    </div>
                </section>
            </div>

            <section className="section" id="licensing">
                <h2>{t('landing.licensingTitle')}</h2>
                <p>
                    {rich('landing.licensingBody', {
                        email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
                        form: <a href={CONTACT_URL}>{t('landing.contactForm')}</a>,
                    })}
                </p>
                <p>
                    {rich('landing.geonamesBody', {
                        geonames: <a href="https://www.geonames.org/">GeoNames</a>,
                        license: (
                            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
                        ),
                    })}
                </p>
                <div className="pricing-grid">
                    {tiers.map((tier) => (
                        <article className="card" key={tier.name}>
                            <h3>{t(tier.name)}</h3>
                            <p className="mono">{t(tier.note)}</p>
                            <p
                                style={{
                                    color: 'hsl(var(--muted-foreground))',
                                    fontSize: '0.875rem',
                                }}
                            >
                                {t(tier.detail)}
                            </p>
                            <a
                                className="btn btn-outline"
                                href={CONTACT_URL}
                                style={{ marginTop: '0.75rem' }}
                            >
                                {t('landing.contactPricing')}
                            </a>
                        </article>
                    ))}
                </div>
            </section>

            <footer className="footer">
                <p>{t('landing.footer', { year: new Date().getFullYear() })}</p>
            </footer>
        </div>
    );
}
