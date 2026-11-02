import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, Route, Routes, Navigate, useParams } from 'react-router-dom';
import { CodeBlock } from '../components/CodeBlock';
import { LicenseBanner } from '../components/LicenseBanner';
import { DOC_PAGES, docBySlug, docPath, type DocBlock } from '../docs/catalog';

function docLinkClass({ isActive }: { isActive: boolean }) {
    return `docs-link${isActive ? ' active' : ''}`;
}

function renderBlock(block: DocBlock, key: number) {
    switch (block.type) {
        case 'p':
            return <p key={key}>{block.text}</p>;
        case 'h3':
            return <h3 key={key}>{block.text}</h3>;
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
    return (
        <article className="doc-article">
            <h1>{page.title}</h1>
            <p className="doc-lead">{page.description}</p>
            {page.blocks.map((b, i) => renderBlock(b, i))}
        </article>
    );
}

export function DocsLayout() {
    const [query, setQuery] = useState('');
    const nav = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return DOC_PAGES.filter((p) => p.slug !== '');
        return DOC_PAGES.filter(
            (p) =>
                p.slug &&
                (p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
        );
    }, [query]);

    return (
        <div className="docs-layout">
            <aside className="docs-sidebar card">
                <label className="docs-search">
                    <span className="sr-only">Search docs</span>
                    <input
                        type="search"
                        placeholder="Search topics…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </label>
                <nav aria-label="Documentation">
                    <NavLink to="/docs" end className={docLinkClass}>
                        Overview
                    </NavLink>
                    {nav.map((p) => (
                        <NavLink key={p.slug} to={docPath(p.slug)} className={docLinkClass}>
                            {p.title}
                        </NavLink>
                    ))}
                </nav>
                <p className="docs-sidebar__hint">
                    Need a license? <Link to="/#licensing">See pricing on Home</Link>.
                </p>
            </aside>
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
