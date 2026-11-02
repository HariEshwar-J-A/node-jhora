import { HashRouter, Route, Routes } from 'react-router-dom';
import { SiteHeader } from './components/SiteHeader';
import { ThemeProvider } from './lib/theme';
import { AppPage } from './pages/AppPage';
import { LandingPage } from './pages/Landing';

export function App() {
    return (
        <ThemeProvider>
            <HashRouter>
                <SiteHeader />
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/app" element={<AppPage />} />
                </Routes>
            </HashRouter>
        </ThemeProvider>
    );
}
