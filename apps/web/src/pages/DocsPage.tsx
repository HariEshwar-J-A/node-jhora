import { useEffect, useMemo, useState } from 'react';
import {
    Link,
    NavLink,
    Outlet,
    Route,
    Routes,
    Navigate,
    useLocation,
    useParams,
} from 'react-router-dom';
import { CodeBlock } from '../components/CodeBlock';
import { LicenseBanner } from '../components/LicenseBanner';
import { Drawer } from '../components/ui/Drawer';
import { DOC_PAGES, docBySlug, docPath, type DocBlock } from '../docs/catalog';
import { MQ_DOCS_COMPACT, useMediaQuery } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

function docLinkClass({ isActive }: { isActive: boolean }) {
    return `docs-link${isActive ? ' active' : ''}`;
}

function headingId(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function renderBlock(block: DocBlock, key: number) {
    switch (block.type) {
        case 'p':
            return <p key={key}>{block.text}</p>;
        case 'h3':
            return (
                <h3 key={key} id={headingId(block.text)}>
                    {block.text}
                </h3>
            );
        case 'ul':
            return (
                <ul key={key}>
                    {block.items.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            );
        case 'code':
            return (
                <CodeBlock key={key} code={block.code} language={block.language ?? 'typescript'} />
            );
        default:
            return null;
    }
}

function DocArticle() {
    const { slug = '' } = useParams();
    const page = docBySlug(slug) ?? docBySlug('')!;
    const { lang, t } = useI18n();
    const headings = page.blocks.flatMap((b) => (b.type === 'h3' ? [b.text] : []));
    return (
        // Reference articles (API names, code) are maintained in English only.
        <article className="doc-article" lang="en">
            {lang !== 'en' && (
                <p className="doc-lang-note" lang={lang}>
                    {t('docs.englishOnly')}
                </p>
            )}
            <h1>{page.title}</h1>
            <p className="doc-lead">{page.description}</p>
            {headings.length >= 2 && (
                <details className="doc-toc">
                    <summary lang={lang}>{t('docs.onThisPage')}</summary>
                    <ul>
                        {headings.map((h) => (
                            <li key={h}>
                                <a
                                    href={`#${headingId(h)}`}
                                    onClick={(event) => {
                                        // The router owns the hash, so scroll to the heading by hand.
                                        event.preventDefault();
                                        document
                                            .getElementById(headingId(h))
                                            ?.scrollIntoView({ block: 'start' });
                                    }}
                                >
                                    {h}
                                </a>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
            {page.blocks.map((b, i) => renderBlock(b, i))}
        </article>
    );
}

function BookIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ChevronIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="m9 6 6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function DocsLayout() {
    const { t, rich } = useI18n();
    const compact = useMediaQuery(MQ_DOCS_COMPACT);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [query, setQuery] = useState('');
    const { pathname } = useLocation();
    const nav = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return DOC_PAGES.filter((p) => p.slug !== '');
        return DOC_PAGES.filter(
            (p) =>
                p.slug &&
                (p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
        );
    }, [query]);

    // Close on navigation (link tap) and when the layout grows past the drawer breakpoint.
    useEffect(() => {
        setDrawerOpen(false);
    }, [pathname]);
    useEffect(() => {
        if (!compact) setDrawerOpen(false);
    }, [compact]);
    // A new page starts at the top, not wherever the previous article was scrolled to.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    const slug = pathname.replace(/^\/docs\/?/, '').split('/')[0] ?? '';
    const current = docBySlug(slug) ?? docBySlug('')!;
    const currentTitle = slug ? current.title : t('docs.overview');

    const navContent = (
        <>
            <label className="docs-search">
                <span className="sr-only">{t('docs.search')}</span>
                <input
                    type="search"
                    placeholder={t('docs.searchPlaceholder')}
                    value={query}
                    enterKeyHint="search"
                    autoComplete="off"
                    onChange={(e) => setQuery(e.target.value)}
                />
            </label>
            <nav aria-label={t('docs.navAria')}>
                <NavLink to="/docs" end className={docLinkClass}>
                    {t('docs.overview')}
                </NavLink>
                {nav.map((p) => (
                    <NavLink key={p.slug} to={docPath(p.slug)} className={docLinkClass} lang="en">
                        {p.title}
                    </NavLink>
                ))}
                {query.trim() && nav.length === 0 && (
                    <p className="docs-empty" role="status">
                        {t('docs.noResults')}
                    </p>
                )}
            </nav>
            <p className="docs-sidebar__hint">
                {rich('docs.hint', {
                    link: <Link to="/#licensing">{t('docs.hintLink')}</Link>,
                })}
            </p>
        </>
    );

    return (
        <div className="docs-layout">
            {compact ? (
                <>
                    <div className="docs-mobilebar">
                        <button
                            type="button"
                            className="docs-mobilebar__btn"
                            data-testid="docs-nav-btn"
                            aria-haspopup="dialog"
                            aria-expanded={drawerOpen}
                            onClick={() => setDrawerOpen(true)}
                        >
                            <BookIcon />
                            <span className="docs-mobilebar__text">
                                <span className="docs-mobilebar__label">{t('docs.browse')}</span>
                                <span className="docs-mobilebar__current" lang="en">
                                    {currentTitle}
                                </span>
                            </span>
                            <ChevronIcon />
                        </button>
                    </div>
                    <Drawer
                        open={drawerOpen}
                        onClose={() => setDrawerOpen(false)}
                        side="left"
                        title={t('docs.navAria')}
                        closeLabel={t('docs.closeNav')}
                        className="docs-drawer"
                    >
                        {navContent}
                    </Drawer>
                </>
            ) : (
                <aside className="docs-sidebar card">{navContent}</aside>
            )}
            <div className="docs-main">
                <LicenseBanner />
                <Outlet />
            </div>
        </div>
    );
}

export function DocsRoutes() {
    return (
        <Routes>
            <Route element={<DocsLayout />}>
                <Route index element={<DocArticle />} />
                <Route path=":slug" element={<DocArticle />} />
                <Route path="*" element={<Navigate to="/docs" replace />} />
            </Route>
        </Routes>
    );
}
