import { HashRouter, Route, Routes } from 'react-router-dom';
import { PageTransition } from './components/PageTransition';
import { SiteHeader } from './components/SiteHeader';
import { ThemeProvider } from './lib/theme';
import { AppPage } from './pages/AppPage';
import { DocsRoutes } from './pages/DocsPage';
import { LandingPage } from './pages/Landing';

export function App() {
    return (
        <ThemeProvider>
            <HashRouter>
                <SiteHeader />
                <PageTransition>
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/app" element={<AppPage />} />
                        <Route path="/docs/*" element={<DocsRoutes />} />
                    </Routes>
                </PageTransition>
            </HashRouter>
        </ThemeProvider>
    );
}
