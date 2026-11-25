import {
    createContext,
    Fragment,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { formatNumber, translator, type MessageKey, type Translate, type Vars } from './core';
import { loadScriptFonts } from './fonts';
import { DEFAULT_LANG, isLang, LANG_META, type Lang } from './langs';

export { LANGS, LANG_META, type Lang } from './langs';
export type { MessageKey, Translate } from './core';

/**
 * Language policy (see apps/web/README or the PR description):
 * - Every fresh load starts in English. There is no navigator.language
 *   detection and nothing is written to localStorage or sessionStorage.
 * - `?lang=ta` / `?lang=hi` in the page URL (before the `#/route` hash)
 *   opens the site in that language, so a shared link keeps its language.
 * - Choosing a language in the switcher updates that query parameter with
 *   history.replaceState (removed again for English), so a reload of the
 *   same URL keeps the choice and a plain visit stays English.
 */
export const LANG_PARAM = 'lang';

function langFromUrl(): Lang {
    if (typeof window === 'undefined') return DEFAULT_LANG;
    const value = new URLSearchParams(window.location.search).get(LANG_PARAM);
    return isLang(value) ? value : DEFAULT_LANG;
}

function writeLangToUrl(lang: Lang) {
    const url = new URL(window.location.href);
    if (lang === DEFAULT_LANG) url.searchParams.delete(LANG_PARAM);
    else url.searchParams.set(LANG_PARAM, lang);
    if (url.href !== window.location.href) {
        window.history.replaceState(window.history.state, '', url.href);
    }
}

type RichValue = ReactNode;

type I18nValue = {
    lang: Lang;
    setLang: (lang: Lang) => void;
    t: Translate;
    /** Translate a message whose `{placeholders}` are React nodes (links, <strong>). */
    rich: (key: MessageKey, nodes: Record<string, RichValue>, vars?: Vars) => ReactNode;
    num: (value: number, fractionDigits?: number) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function richNodes(text: string, nodes: Record<string, RichValue>): ReactNode {
    const parts = text.split(/(\{\w+\})/g);
    return parts.map((part, index) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (m && m[1] in nodes) return <Fragment key={index}>{nodes[m[1]]}</Fragment>;
        return part ? <Fragment key={index}>{part}</Fragment> : null;
    });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>(langFromUrl);

    const setLang = useCallback((next: Lang) => {
        setLangState(next);
        writeLangToUrl(next);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.lang = lang;
        root.dataset.lang = lang;
        loadScriptFonts(lang);
        document.title = translator(lang)('meta.title');
    }, [lang]);

    const value = useMemo<I18nValue>(() => {
        const t = translator(lang);
        return {
            lang,
            setLang,
            t,
            rich: (key, nodes, vars) => richNodes(t(key, vars), nodes),
            num: (n, digits) => formatNumber(lang, n, digits),
        };
    }, [lang, setLang]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n outside LanguageProvider');
    return ctx;
}

export function langLabel(lang: Lang): string {
    return LANG_META[lang].native;
}
