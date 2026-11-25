/**
 * Web UI i18n completeness: every English message key exists in Tamil and
 * Hindi with the same {placeholders}, and every jyotisha term table has an
 * entry for every language.
 */
import { en, type MessageKey } from '../apps/web/src/i18n/locales/en.ts';
import { hi } from '../apps/web/src/i18n/locales/hi.ts';
import { ta } from '../apps/web/src/i18n/locales/ta.ts';
import { LANGS } from '../apps/web/src/i18n/langs.ts';
import { translate } from '../apps/web/src/i18n/core.ts';
import * as terms from '../apps/web/src/i18n/terms.ts';
import {
    boxInsideRect,
    formatPlanetLabel,
    labelBox,
    layoutLabelsInRect,
} from '../apps/web/src/components/chart/chartLayout.ts';
import { NORTH_PLANET_RECTS } from '../apps/web/src/components/chart/geometry.ts';
import {
    dashaLordName,
    karakaName,
    nakshatraFromEnglish,
    tithiLabel,
} from '../apps/web/src/i18n/astro.ts';

const LOCALES = { ta, hi } as const;
/** Keys that are intentionally empty in English (shown only in other languages). */
const EMPTY_IN_EN = new Set<MessageKey>(['docs.englishOnly']);

function placeholders(text: string): string[] {
    return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}

describe('web i18n dictionaries', () => {
    const keys = Object.keys(en) as MessageKey[];

    it.each(Object.entries(LOCALES))('%s has exactly the English keys', (_lang, dict) => {
        expect(Object.keys(dict).sort()).toEqual([...keys].sort());
    });

    it.each(Object.entries(LOCALES))('%s keeps every placeholder', (_lang, dict) => {
        for (const key of keys) {
            expect([key, placeholders(dict[key])]).toEqual([key, placeholders(en[key])]);
        }
    });

    it.each(Object.entries(LOCALES))('%s has no empty strings', (_lang, dict) => {
        const empty = keys.filter((key) => dict[key].trim() === '');
        expect(empty).toEqual([]);
    });

    it('English values are non-empty except the documented exceptions', () => {
        const empty = keys.filter((key) => en[key].trim() === '' && !EMPTY_IN_EN.has(key));
        expect(empty).toEqual([]);
    });

    it('translate interpolates and falls back to English', () => {
        expect(translate('en', 'app.range', { min: 'A', max: 'B' })).toContain('A – B');
        expect(translate('ta', 'nav.home')).not.toBe(en['nav.home']);
        // Empty Tamil/Hindi entries would fall back; English empty stays empty.
        expect(translate('en', 'docs.englishOnly')).toBe('');
    });
});

describe('web i18n term tables', () => {
    const perLangLists = [
        ['SIGN_NAMES_BY_LANG', terms.SIGN_NAMES_BY_LANG, 12],
        ['NAKSHATRA_NAMES_BY_LANG', terms.NAKSHATRA_NAMES_BY_LANG, 27],
        ['TITHI_NAMES_BY_LANG', terms.TITHI_NAMES_BY_LANG, 14],
        ['YOGA_NAMES_BY_LANG', terms.YOGA_NAMES_BY_LANG, 27],
        ['VARA_NAMES_BY_LANG', terms.VARA_NAMES_BY_LANG, 7],
        ['DASHA_LEVELS_BY_LANG', terms.DASHA_LEVELS_BY_LANG, 6],
    ] as const;

    it.each(perLangLists)('%s has full length in every language', (_n, table, length) => {
        for (const lang of LANGS) {
            expect(table[lang]).toHaveLength(length);
            expect(table[lang].slice(_n === 'DASHA_LEVELS_BY_LANG' ? 1 : 0).every(Boolean)).toBe(
                true,
            );
        }
    });

    const keyed = [
        ['PLANET_NAMES', terms.PLANET_NAMES, terms.PLANET_KEYS],
        ['PLANET_SHORT', terms.PLANET_SHORT, terms.PLANET_KEYS],
        ['KARANA_NAMES', terms.KARANA_NAMES, terms.KARANA_KEYS],
        ['DASHA_SYSTEM_NAMES', terms.DASHA_SYSTEM_NAMES, terms.DASHA_SYSTEM_KEYS],
        ['YOGINI_NAMES', terms.YOGINI_NAMES, terms.YOGINI_KEYS],
        ['KARAKA_NAMES', terms.KARAKA_NAMES, terms.KARAKA_KEYS],
        ['KUTA_NAMES', terms.KUTA_NAMES, terms.KUTA_KEYS],
        ['YOGA_RULE_NAMES', terms.YOGA_RULE_NAMES, terms.YOGA_RULE_KEYS],
    ] as const;

    it.each(keyed)('%s covers every key in every language', (_n, table, keys) => {
        for (const lang of LANGS) {
            const t = table[lang] as Record<string, string>;
            for (const key of keys) expect([lang, key, Boolean(t[key])]).toEqual([lang, key, true]);
        }
    });

    it('varga names exist for the same divisions in every language', () => {
        const divisions = Object.keys(terms.VARGA_NAMES_BY_LANG.en).sort();
        for (const lang of LANGS) {
            expect(Object.keys(terms.VARGA_NAMES_BY_LANG[lang]).sort()).toEqual(divisions);
        }
    });

    it('maps engine spellings and indices', () => {
        expect(tithiLabel({ index: 15, name: 'Purnima' }, 'en')).toBe('Purnima');
        expect(tithiLabel({ name: 'Krishna 3' }, 'ta')).toContain(terms.PAKSHA.ta.krishna);
        expect(tithiLabel({ index: 30, name: 'Amavasya' }, 'hi')).toBe(terms.PAKSHA.hi.amavasya);
        expect(nakshatraFromEnglish('Dhanishta', 'hi')).toBe(terms.NAKSHATRA_NAMES_BY_LANG.hi[22]);
        expect(dashaLordName('Aries', 'ta')).toBe(terms.SIGN_NAMES_BY_LANG.ta[0]);
        expect(dashaLordName('Sun', 'hi')).toBe(terms.PLANET_NAMES.hi.Sun);
        expect(karakaName('AK', 'en')).toContain('Atmakaraka');
    });
});

describe('localized chart labels', () => {
    it.each(['ta', 'hi'] as const)('%s retrograde nodes fit every North house', (lang) => {
        const items = ['Rahu', 'Ketu', 'Saturn'].map((name) => ({
            id: name,
            text: formatPlanetLabel(name, 16, true, false, lang),
        }));
        for (const [house, rect] of Object.entries(NORTH_PLANET_RECTS)) {
            for (const slot of layoutLabelsInRect(rect, items)) {
                const box = labelBox(slot.x, slot.y, slot.text, slot.fontSize, 'middle');
                expect([lang, house, slot.text, boxInsideRect(box, rect, 0)]).toEqual([
                    lang,
                    house,
                    slot.text,
                    true,
                ]);
            }
        }
    });
});
