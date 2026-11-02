import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { PageTransition } from './components/PageTransition';
import { SiteHeader } from './components/SiteHeader';
import { ThemeProvider } from './lib/theme';
import { AppPage } from './pages/AppPage';

const LandingPage = lazy(() => import('./pages/Landing').then((m) => ({ default: m.LandingPage })));
const DocsRoutes = lazy(() => import('./pages/DocsPage').then((m) => ({ default: m.DocsRoutes })));

function RouteFallback() {
    return (
        <div className="card" style={{ margin: '1.25rem', maxWidth: 480 }}>
            <p>Loading…</p>
        </div>
    );
}

export function App() {
    return (
        <ThemeProvider>
            <HashRouter>
                <SiteHeader />
                <PageTransition>
                    <Suspense fallback={<RouteFallback />}>
                        <Routes>
                            <Route path="/" element={<LandingPage />} />
                            <Route path="/app" element={<AppPage />} />
                            <Route path="/docs/*" element={<DocsRoutes />} />
                        </Routes>
                    </Suspense>
                </PageTransition>
            </HashRouter>
        </ThemeProvider>
    );
}
