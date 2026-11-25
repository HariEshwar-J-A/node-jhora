import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { PageTransition } from './components/PageTransition';
import { SiteHeader } from './components/SiteHeader';
import { LanguageProvider, useI18n } from './i18n';
import { ThemeProvider } from './lib/theme';
import { LandingPage } from './pages/Landing';

const AppPage = lazy(() => import('./pages/AppPage').then((m) => ({ default: m.AppPage })));
const DocsRoutes = lazy(() => import('./pages/DocsPage').then((m) => ({ default: m.DocsRoutes })));

function RouteFallback() {
    const { t } = useI18n();
    return (
        <div className="card" style={{ margin: '1.25rem', maxWidth: 480 }}>
            <p>{t('common.loading')}</p>
        </div>
    );
}

export function App() {
    return (
        <LanguageProvider>
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
        </LanguageProvider>
    );
}
