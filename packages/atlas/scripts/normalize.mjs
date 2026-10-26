/** Shared with build script (kept in sync with src/normalize.ts). */

/**
 * Combining marks that are optional accents rather than letters: the generic
 * combining-diacritics blocks used by Latin, Greek and Cyrillic, Hebrew points
 * and Arabic harakat. Indic vowel signs and viramas, Thai vowels, and Japanese
 * (han)dakuten are NOT folded: they distinguish names (बैरूत Beirut vs बेरात
 * Berat, ながの Nagano vs なかの Nakano).
 */
const FOLDABLE_MARKS =
    /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed]+/gu;

export function normalizeSearchKey(input) {
    let s = input.trim();
    if (s.length === 0) return '';

    s = s.normalize('NFD');
    s = s.replace(FOLDABLE_MARKS, '');
    s = s.normalize('NFC');
    s = s.toLocaleLowerCase('en-US');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

export function shardIdForKey(normalizedKey) {
    if (normalizedKey.length === 0) return 'empty';
    const first = normalizedKey.codePointAt(0);
    if (first >= 0x61 && first <= 0x7a) {
        const second = normalizedKey.length > 1 ? normalizedKey.codePointAt(1) : 0;
        if (second >= 0x61 && second <= 0x7a) {
            return `la-${normalizedKey.slice(0, 2)}`;
        }
        return `la-${normalizedKey[0]}`;
    }
    if (first >= 0x30 && first <= 0x39) {
        const second = normalizedKey.length > 1 ? normalizedKey.codePointAt(1) : 0;
        if (second >= 0x30 && second <= 0x39) {
            return `nu-${normalizedKey.slice(0, 2)}`;
        }
        return `nu-${normalizedKey[0]}`;
    }
    return `u-${first.toString(16)}`;
}
